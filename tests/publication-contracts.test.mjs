import assert from "node:assert/strict";
import test from "node:test";
import { applyAfterCommit } from "../packages/renderer/src/shared/services/script-application-service.ts";
test("a failed apply does not reject a successful durable save", async () => {
  const outcome = await applyAfterCommit(["one"], async () => {
    throw new Error("page closed");
  });
  assert.equal(outcome.status, "blocked");
  assert.equal(outcome.message, "page closed");
  assert.equal(outcome.appliedTabCount, 0);
});
