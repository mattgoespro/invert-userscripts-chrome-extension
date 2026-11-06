import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

let dispatch;

function compile(sourceCode, options = {}) {
  return new Promise((resolve) => {
    const id = String(Math.random());
    pending.set(id, resolve);
    dispatch({
      data: { type: "compile", id, sourceCode, ...options },
    });
  });
}

const pending = new Map();

before(async () => {
  globalThis.self = {
    addEventListener: (_type, listener) => {
      dispatch = listener;
    },
    postMessage: (message) => {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    },
  };
  await import("../packages/renderer/src/sandbox/build-worker.ts");
});

describe("build worker syntax diagnostics", () => {
  it("fails unparsable source with its line and column", async () => {
    const result = await compile("const ok = 1;\nlet a = ;");
    assert.equal(result.success, false);
    assert.equal(result.code, undefined);
    assert.equal(result.error, "Line 2, column 9: Expression expected.");
  });

  it("reports every error, even when transpile emits nothing", async () => {
    const result = await compile("function ( {");
    assert.equal(result.success, false);
    assert.deepEqual(result.error.split("\n"), [
      "Line 1, column 10: Identifier expected.",
      "Line 1, column 13: '}' expected.",
    ]);
  });

  it("still builds valid source, ignoring type errors and top-level returns", async () => {
    for (const source of [
      "export const value: number = 1;",
      'const wrong: number = "type errors stay with the language service";',
      "if (location.hash) { return; }",
      "await Promise.resolve();",
      "",
    ]) {
      const result = await compile(source);
      assert.equal(result.success, true, source);
      assert.equal(result.error, undefined);
    }
  });

  it("does not gate analysis or declaration requests on syntax", async () => {
    const analysis = await compile("let a = ;", { analysisOnly: true });
    assert.equal(analysis.success, true);
    const declarations = await compile("declare const = ;", {
      declarationsOnly: true,
    });
    assert.equal(declarations.success, true);
  });
});
