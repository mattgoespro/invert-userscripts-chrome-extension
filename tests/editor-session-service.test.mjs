import assert from "node:assert/strict";
import test from "node:test";
import {
  captureSessionBuffers,
  canRestoreCheckpoint,
} from "../packages/renderer/src/shared/services/editor-session-service.ts";
test("save snapshot reads all live models instead of lagging Redux text", () => {
  const snapshot = captureSessionBuffers(
    { typescript: "old", scss: "old-css", typeDefinitions: "old-types" },
    (buffer) =>
      buffer === "typescript"
        ? { getValue: () => "new", getVersionId: () => 7 }
        : null
  );
  assert.deepEqual(snapshot.buffers, {
    typescript: "new",
    scss: "old-css",
    typeDefinitions: "old-types",
  });
  assert.equal(snapshot.modelVersions.typescript, 7);
});
test("recovery restores only against the checkpoint base and keeps changed/deleted bases as conflicts", () => {
  assert.equal(canRestoreCheckpoint("base", "base"), true);
  assert.equal(canRestoreCheckpoint("base", "new"), false);
  assert.equal(canRestoreCheckpoint("base", null), false);
});
