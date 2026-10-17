import assert from "node:assert/strict";
import test from "node:test";
import { migrateLegacyDocuments } from "../packages/shared/src/storage/indexeddb/migration.ts";
import {
  applyMutation,
  emptyRepositoryState,
} from "../packages/shared/src/storage/document-repository.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

test("a changing shadow import removes vanished scripts before verified cutover", async () => {
  let state = emptyRepositoryState();
  const repository = {
    state: async () => state,
    snapshot: async () => ({
      ...state,
      documents: Object.values(state.documents),
    }),
    commit: async (command) => {
      const result = applyMutation(state, command);
      state = result.state;
      return result.outcome;
    },
    update: async (transform) => {
      const result = transform(state);
      state = result.state;
      return result.value;
    },
  };
  let reads = 0;
  const a = buildUserscriptFixture({ id: "a", moduleName: "a" });
  const b = buildUserscriptFixture({ id: "b", moduleName: "b" });
  await migrateLegacyDocuments(repository, async () => ({
    scripts: ++reads === 1 ? { a, b } : { a },
    artifacts: {},
    modules: {},
    settings: {},
  }));
  assert.deepEqual(Object.keys(state.documents), ["a"]);
  assert.equal(
    Object.values(state.outbox).some(
      (entry) => entry.id === "b" && entry.script
    ),
    false
  );
});
