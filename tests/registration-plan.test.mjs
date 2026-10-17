import assert from "node:assert/strict";
import test from "node:test";
import { planRegistrations } from "../packages/runtime/src/ide/registration-plan.ts";
test("registration planning does not approximate legacy completion timing or unsafe URL globs", () => {
  const result = planRegistrations([
    { id: "a", urlPatterns: ["*://*/*"], runAt: "afterPageLoad" },
    {
      id: "b",
      urlPatterns: ["https://example.com/?x=*"],
      runAt: "beforePageLoad",
    },
  ]);
  assert.deepEqual(result.registrations, []);
  assert.equal(result.deferred.length, 2);
});
