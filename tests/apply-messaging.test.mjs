import assert from "node:assert/strict";
import test from "node:test";
import { describeApplyResult } from "../packages/renderer/src/shared/store/slices/userscripts/messaging.ts";

test("describeApplyResult reports partial and total inject failures", () => {
  assert.deepEqual(
    describeApplyResult({ success: false, appliedTabCount: 0 }),
    {
      variant: "error",
      message: "Failed to inject the script into matching tabs.",
    }
  );
  assert.equal(
    describeApplyResult({ success: false, appliedTabCount: 2 }).variant,
    "error"
  );
});

test("describeApplyResult explains stale compiled skips", () => {
  assert.deepEqual(
    describeApplyResult({
      success: true,
      appliedTabCount: 0,
      staleSkipCount: 1,
    }),
    {
      variant: "info",
      message: "Matching tabs were skipped until compiled output is current.",
    }
  );
});

test("describeApplyResult reports successful applies", () => {
  assert.deepEqual(describeApplyResult({ success: true, appliedTabCount: 1 }), {
    variant: "info",
    message: "Applied to 1 matching tab",
  });
});

test("describeApplyResult mentions stale skips alongside successful applies", () => {
  assert.deepEqual(
    describeApplyResult({
      success: true,
      appliedTabCount: 2,
      staleSkipCount: 1,
    }),
    {
      variant: "info",
      message:
        "Applied to 2 matching tabs. Some matching tabs were skipped until compiled output is current.",
    }
  );
});
