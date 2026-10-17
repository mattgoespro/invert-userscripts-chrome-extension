import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { minifyUserscript } from "../packages/renderer/src/sandbox/minifier.ts";
test("minifying an async initialization retains its completion promise", async () => {
  const code = await minifyUserscript(
    "(async function(){await Promise.resolve();window.ready=true;})();"
  );
  const window = {};
  const completion = vm.runInNewContext(code, { window, Promise });
  assert.equal(typeof completion?.then, "function");
  await completion;
  assert.equal(window.ready, true);
});
