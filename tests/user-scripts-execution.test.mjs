import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  hasAsyncCompletion,
  getAsyncCompletionExpression,
} from "../packages/renderer/src/sandbox/module-analysis.ts";
import {
  detectExecutionCapability,
  executeUserScript,
} from "../packages/runtime/src/ide/user-scripts-executor.ts";
test("uncompleted JavaScript releases the queue with an unknown outcome", async () => {
  const api = {
    getScripts: async () => [],
    execute: () => new Promise(() => {}),
  };
  await assert.rejects(
    () => executeUserScript({ tabId: 1, code: "(async()=>{})()" }, api, 10),
    (error) => error.name === "UnknownExecutionError"
  );
});
test("revoked permission blocks execution even when userScripts remains defined", async () => {
  const api = {
    getScripts: async () => {
      throw new Error("revoked");
    },
    execute: async () => {
      throw new Error("must not execute");
    },
  };
  assert.equal(await detectExecutionCapability(api), "permission-required");
  await assert.rejects(
    () => executeUserScript({ tabId: 1, code: "1" }, api),
    /Allow User Scripts/
  );
});
test("one-off execution uses MAIN and reports per-frame execution errors", async () => {
  let requested;
  const api = {
    getScripts: async () => [],
    execute: async (request) => {
      requested = request;
      return [{ error: "page error" }];
    },
  };
  await assert.rejects(
    () =>
      executeUserScript(
        {
          tabId: 42,
          documentId: "doc",
          code: "const x=1",
          injectImmediately: true,
        },
        api
      ),
    /page error/
  );
  assert.equal(requested.world, "MAIN");
  assert.deepEqual(requested.target, { tabId: 42, documentIds: ["doc"] });
  assert.deepEqual(requested.js, [{ code: "const x=1\n;true;" }]);
});

test("Chrome null results from synchronous throws and rejected wrappers block dependencies", async () => {
  const api = {
    getScripts: async () => [],
    execute: async ({ js }) => {
      try {
        return [{ result: await vm.runInNewContext(js[0].code) }];
      } catch {
        return [{ result: null }];
      }
    },
  };
  for (const code of [
    'throw new Error("sync");',
    '(async()=>{throw new Error("async")})();',
  ]) {
    await assert.rejects(
      () =>
        executeUserScript(
          { tabId: 1, code, awaitCompletion: hasAsyncCompletion(code) },
          api
        ),
      /before completion/
    );
  }
});

test("completion markers preserve classic globals and await async wrappers", async () => {
  const context = vm.createContext({ setTimeout });
  const api = {
    getScripts: async () => [],
    execute: async ({ js }) => [
      { result: await vm.runInContext(js[0].code, context) },
    ],
  };
  await executeUserScript({ tabId: 1, code: "let classic=1; var cdn=2;" }, api);
  assert.equal(vm.runInContext("classic+cdn", context), 3);
  await executeUserScript(
    {
      tabId: 1,
      awaitCompletion: true,
      code: "(async()=>{await new Promise(resolve=>setTimeout(resolve,10));globalThis.finished=true;})();",
    },
    api
  );
  assert.equal(context.finished, true);
  // An ordinary script's incidental thenable completion must not stall execution.
  await executeUserScript({ tabId: 1, code: "new Promise(()=>{});" }, api, 10);
});

test("worker AST distinguishes complete async wrappers from classic declarations and multiple statements", async () => {
  const context = vm.createContext({});
  const api = {
    getScripts: async () => [],
    execute: async ({ js }) => [
      { result: await vm.runInContext(js[0].code, context) },
    ],
  };
  for (const code of [
    "async function helper(){return 42;} globalThis.ready=true;",
    "async function another(){}",
    "(async function*(){yield 1;})()",
    "(async()=>{})(); globalThis.after=true;",
  ]) {
    assert.equal(hasAsyncCompletion(code), false);
    await executeUserScript(
      { tabId: 1, code, awaitCompletion: hasAsyncCompletion(code) },
      api
    );
  }
  assert.equal(
    vm.runInContext("typeof helper+typeof another", context),
    "functionfunction"
  );
  assert.equal(context.after, true);
  assert.equal(hasAsyncCompletion("(async function(){await 1;})();"), true);
  assert.equal(
    getAsyncCompletionExpression("(async()=>{})(); // trailing comment"),
    "(async()=>{})()"
  );
});
