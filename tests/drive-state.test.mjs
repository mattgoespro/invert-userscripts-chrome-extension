import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMutation,
  emptyRepositoryState,
} from "../packages/shared/src/storage/document-repository.ts";
import {
  enableDriveState,
  mergeDriveRecords,
  setDriveLayout,
  resolveDrivePreference,
} from "../packages/shared/src/storage/drive-sync.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

test("cyclic or cross-entity revision ancestry is rejected before hydration", () => {
  const state = initial();
  const before = structuredClone(state);
  assert.throws(
    () =>
      mergeDriveRecords(state, [
        remote("cycle-a", ["cycle-b"]),
        remote("cycle-b", ["cycle-a"]),
      ]),
    /ancestry/i
  );
  assert.deepEqual(state, before);
  assert.throws(
    () =>
      mergeDriveRecords(state, [
        remote("script-parent"),
        {
          kind: "settings",
          revision: "bad-parent",
          parents: ["script-parent"],
          value: { fontSize: 12 },
        },
      ]),
    /ancestry/i
  );
  assert.deepEqual(state, before);
});

test("a valid remote alias swap is checked against the final document set", () => {
  const state = emptyRepositoryState();
  enableDriveState(state);
  const a = {
    kind: "script",
    id: "a",
    revision: "a1",
    parents: [],
    script: buildUserscriptFixture({ id: "a", moduleName: "alpha" }),
  };
  const b = {
    kind: "script",
    id: "b",
    revision: "b1",
    parents: [],
    script: buildUserscriptFixture({ id: "b", moduleName: "beta" }),
  };
  mergeDriveRecords(state, [a, b]);
  mergeDriveRecords(state, [
    {
      ...a,
      revision: "a2",
      parents: ["a1"],
      script: { ...a.script, moduleName: "beta" },
    },
    {
      ...b,
      revision: "b2",
      parents: ["b1"],
      script: { ...b.script, moduleName: "alpha" },
    },
  ]);
  assert.equal(state.documents.a.script.moduleName, "beta");
  assert.equal(state.documents.b.script.moduleName, "alpha");
  assert.deepEqual(state.syncConflicts, {});
});

const script = (name = "Saved") =>
  buildUserscriptFixture({
    id: "drive-script",
    moduleName: "drive-script",
    name,
  });
function initial() {
  const state = emptyRepositoryState();
  enableDriveState(state);
  return state;
}
const remote = (revision, parents = [], name = "Remote") => ({
  kind: "script",
  id: "drive-script",
  revision,
  parents,
  script: script(name),
});

test("a fresh repository restores source, settings and layout without queuing installation defaults", () => {
  const state = initial();
  mergeDriveRecords(state, [
    remote("remote-1"),
    {
      kind: "settings",
      revision: "settings-1",
      parents: [],
      value: { fontSize: 19 },
    },
    {
      kind: "layout",
      revision: "layout-1",
      parents: [],
      value: {
        activeSidebarTab: "settings",
        panelSizes: { scriptListSidebarWidth: 37 },
      },
    },
  ]);
  assert.equal(state.documents["drive-script"].script.name, "Remote");
  assert.equal(state.settings.fontSize, 19);
  assert.equal(state.drive.layout.panelSizes.scriptListSidebarWidth, 37);
  assert.deepEqual(state.drive.pending, []);
});
test("source and preference writes atomically queue the exact committed revisions", () => {
  let state = initial();
  state = applyMutation(state, {
    requestId: "write",
    writes: [{ id: "drive-script", expectedRevision: null, script: script() }],
    settings: { expectedRevision: null, value: { fontSize: 16 } },
  }).state;
  assert.ok(
    state.drive.pending.includes(state.documents["drive-script"].revision)
  );
  assert.ok(state.drive.pending.includes(state.settingsRevision));
  assert.equal(state.drive.records[state.settingsRevision].value.fontSize, 16);
});
test("offline source edits preserve competing cloud branches until explicit resolution", () => {
  let state = initial();
  mergeDriveRecords(state, [remote("base")]);
  state = applyMutation(state, {
    requestId: "offline",
    writes: [
      {
        id: "drive-script",
        expectedRevision: "base",
        script: script("Offline"),
      },
    ],
  }).state;
  mergeDriveRecords(state, [remote("other", ["base"], "Other browser")]);
  assert.equal(state.documents["drive-script"].script.name, "Offline");
  assert.ok(
    state.syncConflicts["drive-script"].some((x) => x.revision === "other")
  );
  assert.equal(state.drive.pending.length, 1);
});
test("absence never deletes a document; an explicit descendant tombstone does", () => {
  const state = initial();
  mergeDriveRecords(state, [remote("base")]);
  mergeDriveRecords(state, []);
  assert.ok(state.documents["drive-script"]);
  mergeDriveRecords(state, [
    {
      kind: "script",
      id: "drive-script",
      revision: "deleted",
      parents: ["base"],
    },
  ]);
  assert.equal(state.documents["drive-script"], undefined);
  assert.equal(state.tombstones["drive-script"].revision, "deleted");
});
test("layout writes remain pending and concurrent preference versions require an explicit choice", () => {
  const state = initial();
  setDriveLayout(state, { activeSidebarTab: "scripts" });
  const local = state.drive.layoutRevision;
  mergeDriveRecords(state, [
    {
      kind: "layout",
      revision: "remote-layout",
      parents: [],
      value: { activeSidebarTab: "settings" },
    },
  ]);
  assert.equal(state.drive.layout.activeSidebarTab, "scripts");
  assert.equal(state.drive.heads.layout.length, 2);
  resolveDrivePreference(state, "layout", "remote-layout", state.generation);
  assert.equal(state.drive.layout.activeSidebarTab, "settings");
  assert.equal(state.drive.heads.layout.length, 1);
  assert.ok(
    state.drive.records[state.drive.layoutRevision].parents.includes(local)
  );
});
test("incomplete ancestry converges once a late parent arrives", () => {
  const state = initial();
  mergeDriveRecords(state, [remote("a"), remote("c", ["b"], "Newest")]);
  mergeDriveRecords(state, [remote("b", ["a"], "Middle")]);
  assert.equal(state.documents["drive-script"].script.name, "Newest");
  assert.deepEqual(state.syncConflicts["drive-script"], undefined);
});
test("invalid remote data and revision collisions cannot mutate authoritative state", () => {
  const state = initial();
  mergeDriveRecords(state, [remote("base")]);
  const before = structuredClone(state);
  assert.throws(
    () => mergeDriveRecords(state, [remote("base", [], "Tampered")]),
    /revision/i
  );
  assert.deepEqual(state, before);
  assert.throws(
    () =>
      mergeDriveRecords(state, [
        {
          kind: "layout",
          revision: "bad",
          parents: [],
          value: { panelSizes: { scriptListSidebarWidth: NaN } },
        },
      ]),
    /invalid/i
  );
  assert.deepEqual(state, before);
});
