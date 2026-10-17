import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyRepositoryState,
  applyMutation,
} from "../packages/shared/src/storage/document-repository.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";
const create = (requestId, id = "a", moduleName = "a") => ({
  requestId,
  writes: [
    {
      id,
      expectedRevision: null,
      script: buildUserscriptFixture({ id, moduleName }),
    },
  ],
});
test("artifact-only rebuilds do not create a source revision or replication work", () => {
  let state = applyMutation(
    emptyRepositoryState(),
    create("initial-artifact")
  ).state;
  const original = structuredClone(state.documents.a);
  state.outbox = {};
  const result = applyMutation(state, {
    requestId: "rebuild-artifact",
    writes: [
      {
        id: "a",
        expectedRevision: original.revision,
        artifact: { javascript: "rebuilt", css: "" },
      },
    ],
  });
  assert.equal(result.outcome.status, "committed");
  assert.deepEqual(result.state.documents.a, original);
  assert.deepEqual(result.state.outbox, {});
  assert.equal(result.state.artifacts.a.javascript, "rebuilt");
  assert.equal(result.state.cssOutbox.a, "rebuild-artifact");
});
test("ordinary saves retain unresolved remote heads without claiming to merge them", () => {
  let state = applyMutation(emptyRepositoryState(), create("initial")).state;
  const local = state.documents.a.revision;
  state.syncRecords.remote = { revision: "remote", parents: [] };
  state.syncHeads.a = [local, "remote"];
  state.syncConflicts.a = [
    {
      id: "a",
      revision: "remote",
      parents: [],
      script: buildUserscriptFixture({ id: "a", name: "Remote" }),
    },
  ];
  state = applyMutation(state, {
    requestId: "edit",
    writes: [
      {
        id: "a",
        expectedRevision: local,
        script: buildUserscriptFixture({ id: "a", name: "Local edit" }),
      },
    ],
  }).state;
  assert.deepEqual(state.documents.a.parents, [local]);
  assert.ok(state.syncHeads.a.includes("remote"));
  assert.equal(state.syncConflicts.a[0].revision, "remote");
});
test("conditional commits reject stale writers and receipts make retries idempotent", () => {
  let state = emptyRepositoryState();
  const command = create("create");
  const first = applyMutation(state, command);
  state = first.state;
  assert.equal(first.outcome.status, "committed");
  const revision = first.outcome.documents[0].revision;
  const duplicate = applyMutation(state, command);
  assert.deepEqual(duplicate.outcome, first.outcome);
  const save = {
    requestId: "save",
    writes: [
      {
        id: "a",
        expectedRevision: revision,
        script: buildUserscriptFixture({ id: "a", name: "new" }),
      },
    ],
  };
  state = applyMutation(state, save).state;
  assert.equal(
    applyMutation(state, { ...save, requestId: "stale" }).outcome.status,
    "conflict"
  );
  assert.equal(state.documents.a.script.name, "new");
});
test("alias collisions abort the entire batch and deleted records cannot be recreated by delayed saves", () => {
  let state = applyMutation(emptyRepositoryState(), create("create")).state;
  const collision = {
    requestId: "batch",
    writes: [
      ...create("x", "b", "same").writes,
      ...create("x", "c", "same").writes,
    ],
  };
  assert.equal(applyMutation(state, collision).outcome.status, "rejected");
  assert.equal(state.documents.b, undefined);
  const revision = state.documents.a.revision;
  state = applyMutation(state, {
    requestId: "delete",
    writes: [{ id: "a", expectedRevision: revision, deleted: true }],
  }).state;
  assert.equal(
    applyMutation(state, {
      requestId: "late",
      writes: [{ ...create("x").writes[0], expectedRevision: revision }],
    }).outcome.status,
    "conflict"
  );
  assert.equal(state.documents.a, undefined);
});
test("settings and module writes compare revisions without replacing unrelated documents", () => {
  const state = applyMutation(emptyRepositoryState(), create("c")).state;
  const result = applyMutation(state, {
    requestId: "settings",
    writes: [],
    settings: { expectedRevision: null, value: { fontSize: 14 } },
  });
  assert.equal(result.state.settings.fontSize, 14);
  assert.ok(result.state.documents.a);
  assert.equal(
    applyMutation(result.state, {
      requestId: "stale-settings",
      writes: [],
      settings: { expectedRevision: null, value: { fontSize: 20 } },
    }).outcome.status,
    "conflict"
  );
});
