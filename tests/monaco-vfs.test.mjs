import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function harness(models) {
  const exports = {};
  const monacoEditor = {
    Uri: { parse: (uri) => uri },
    editor: {
      getModel: (uri) => models.get(uri) ?? null,
      createModel: () => {
        throw new Error("unexpected model creation");
      },
    },
  };
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("../packages/monaco/src/typescript/vfs.ts", import.meta.url),
        "utf8"
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }
    ).outputText,
    {
      exports,
      require: (name) => (name === "monaco-editor" ? monacoEditor : {}),
    }
  );
  return exports;
}

function fakeModel(value, eol) {
  const edits = [];
  return {
    edits,
    isDisposed: () => false,
    getValue: () => value,
    getEOL: () => eol,
    getFullModelRange: () => ({}),
    pushEditOperations: (_selections, operations) => {
      edits.push(operations[0].text);
    },
  };
}

const uri = "file:///userscripts/a/main.ts";

test("line-ending differences do not rewrite a model", () => {
  for (const [value, eol, incoming] of [
    ["a\r\nb\r\n", "\r\n", "a\nb\n"],
    ["a\nb\n", "\n", "a\r\nb\r\n"],
    ["a\r\nb", "\r\n", "a\r\nb"],
    ["a\nb", "\n", "a\rb"],
  ]) {
    const model = fakeModel(value, eol);
    harness(new Map([[uri, model]])).upsertWorkspaceModel(
      uri,
      "typescript",
      incoming
    );
    assert.deepEqual(model.edits, []);
  }
});

test("real content changes still apply through an undoable edit", () => {
  const model = fakeModel("a\r\nb", "\r\n");
  harness(new Map([[uri, model]])).upsertWorkspaceModel(
    uri,
    "typescript",
    "a\nc"
  );
  assert.deepEqual(model.edits, ["a\nc"]);
});

test("a preserved buffer is left alone even when its text changed", () => {
  const model = fakeModel("draft", "\n");
  harness(new Map([[uri, model]])).upsertWorkspaceModel(
    uri,
    "typescript",
    "remote",
    { preserveAttachedBuffer: true }
  );
  assert.deepEqual(model.edits, []);
});
