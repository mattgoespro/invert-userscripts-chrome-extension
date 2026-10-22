import assert from "node:assert/strict";
import test from "node:test";
import * as ts from "typescript";
import { userscriptWindowDeclarations } from "../packages/monaco/src/typescript/window-globals.ts";

test("dynamic Window members preserve built-in, declared custom, and ordinary object types", () => {
  const files = new Map([
    ["/window-globals.d.ts", userscriptWindowDeclarations],
    [
      "/typed-window.d.ts",
      "interface Window { typedCustom: { count: number }; }",
    ],
    [
      "/main.ts",
      [
        "window.log = console.log;",
        'window.log("ok");',
        "window.toaster = null;",
        "console.log(window.toaster);",
        "window.name = 42;",
        "window.atob(42);",
        'window.typedCustom = { count: "wrong" };',
        "const ordinary = { value: 1 };",
        "console.log(ordinary.missing);",
      ].join("\n"),
    ],
  ]);
  const options = {
    target: ts.ScriptTarget.ES2020,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    lib: ["lib.es2020.d.ts", "lib.dom.d.ts"],
  };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (path, languageVersion, ...args) =>
    files.has(path)
      ? ts.createSourceFile(path, files.get(path), languageVersion, true)
      : originalGetSourceFile(path, languageVersion, ...args);
  const program = ts.createProgram([...files.keys()], options, host);
  const errors = program.getSemanticDiagnostics();
  assert.deepEqual(
    errors.map((error) => ({
      line: error.file.getLineAndCharacterOfPosition(error.start).line + 1,
      code: error.code,
    })),
    [
      { line: 5, code: 2322 },
      { line: 6, code: 2345 },
      { line: 7, code: 2322 },
      { line: 9, code: 2339 },
    ]
  );
});
