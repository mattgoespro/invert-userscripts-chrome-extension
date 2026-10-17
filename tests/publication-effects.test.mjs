import assert from "node:assert/strict";
import test from "node:test";
import { effectDecision } from "../packages/runtime/src/publication/effects.ts";
test("interrupted execution is unknown and completed effects replay their receipt", () => {
  assert.equal(effectDecision({ status: "started" }).status, "unknown");
  assert.deepEqual(
    effectDecision({
      status: "completed",
      result: { success: true, appliedTabCount: 2 },
    }),
    { success: true, appliedTabCount: 2 }
  );
  assert.equal(effectDecision(undefined), null);
});
