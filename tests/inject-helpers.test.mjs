import assert from "node:assert/strict";
import test from "node:test";
import {
  runIsolatedInjectTasks,
  shouldAwaitInjectedEvalResult,
} from "../packages/runtime/src/ide/inject-helpers.ts";

test("shouldAwaitInjectedEvalResult is true only for async IIFE wraps", () => {
  assert.equal(
    shouldAwaitInjectedEvalResult("(async () => {\nconst x = await 1;\n})();"),
    true
  );
  assert.equal(
    shouldAwaitInjectedEvalResult("(async function(){await 1;})();"),
    true
  );
  assert.equal(
    shouldAwaitInjectedEvalResult("!async function(){await 1;}();"),
    true
  );
  assert.equal(shouldAwaitInjectedEvalResult("(async()=>{await 1})();"), true);
  assert.equal(shouldAwaitInjectedEvalResult("var x = 1;"), false);
  assert.equal(shouldAwaitInjectedEvalResult("fetch('/x');"), false);
  assert.equal(
    shouldAwaitInjectedEvalResult("!function(){fetch('/x')}();"),
    false
  );
  assert.equal(
    shouldAwaitInjectedEvalResult("  (async () => { await 1; })();"),
    true
  );
});

test("runIsolatedInjectTasks continues after a thrown step", async () => {
  const ran = [];
  const originalError = console.error;
  console.error = () => {};

  try {
    const result = await runIsolatedInjectTasks([
      {
        label: "ok-1",
        run: async () => {
          ran.push("ok-1");
        },
      },
      {
        label: "boom",
        run: async () => {
          ran.push("boom");
          throw new Error("cdn failed");
        },
      },
      {
        label: "ok-2",
        run: async () => {
          ran.push("ok-2");
        },
      },
    ]);

    assert.deepEqual(ran, ["ok-1", "boom", "ok-2"]);
    assert.equal(result.succeeded, 2);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].label, "boom");
  } finally {
    console.error = originalError;
  }
});
