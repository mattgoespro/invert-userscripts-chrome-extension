import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as ts from "typescript";
import { buildOwnDeclarations } from "../packages/renderer/src/sandbox/declaration-analysis.ts";

function diagnostics(files) {
  const options = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    moduleDetection: ts.ModuleDetectionKind.Force,
    noLib: true,
  };
  const host = ts.createCompilerHost(options);
  host.fileExists = (path) => Object.hasOwn(files, path);
  host.readFile = (path) => files[path];
  host.directoryExists = (directory) =>
    Object.keys(files).some((path) => path.startsWith(directory + "/"));
  host.getSourceFile = (path, languageVersion) =>
    files[path] === undefined
      ? undefined
      : ts.createSourceFile(path, files[path], languageVersion, true);
  host.getCurrentDirectory = () => "/";
  const program = ts.createProgram(Object.keys(files), options, host);
  return program.getSemanticDiagnostics().map((item) => ({
    file: item.file.fileName,
    code: item.code,
    message: ts.flattenDiagnosticMessageText(item.messageText, " "),
  }));
}

describe("owner-local declarations in the real TypeScript program", () => {
  for (const prefix of ["", "export "]) {
    it(`binds ${prefix || "unexported "}generic types, interfaces and values to their owner`, () => {
      const source = `
        interface Private { label: string }
        ${prefix}type T<V extends Private = Private> = { value: V };
        ${prefix}interface Options { count: number }
        declare function createValue(): T;
      `;
      assert.deepEqual(
        diagnostics({
          "/owner/main.ts":
            "const t: T = createValue(); const o: Options = { count: 1 }; const s: string = t.value.label;",
          "/owner/own.d.ts": buildOwnDeclarations(source),
        }),
        []
      );
    });
  }

  it("preserves imported dependencies and relative paths without making the shim global", () => {
    const source =
      'import type { Base } from "../dependency/types";\nexport type T = Base & { count: number };';
    assert.deepEqual(
      diagnostics({
        "/dependency/types.d.ts": "export interface Base { label: string }",
        "/owner/types.d.ts": source,
        "/owner/own.d.ts": buildOwnDeclarations(source),
        "/owner/main.ts": 'const own: T = { label: "a", count: 1 };',
        "/consumer/main.ts":
          'import type { T } from "../owner/types"; const imported: T = { label: "b", count: 2 };',
      }),
      []
    );
  });

  it("keeps same-named owner types distinct, including offscreen return type inference", () => {
    const numberTypes = "export type T = { value: number };";
    const stringTypes = "export interface T { value: string }";
    const result = diagnostics({
      "/number/types.d.ts": numberTypes,
      "/number/own.d.ts": buildOwnDeclarations(numberTypes),
      "/number/main.ts":
        "export function value(input: T) { return input.value; }",
      "/string/types.d.ts": stringTypes,
      "/string/own.d.ts": buildOwnDeclarations(stringTypes),
      "/string/main.ts":
        "export function value(input: T) { return input.value; }",
      "/consumer/main.ts":
        'import { value as numberValue } from "../number/main"; import { value as stringValue } from "../string/main"; const wrong: string = numberValue({ value: 1 }); const correct: string = stringValue({ value: "a" }); const hidden: T = {};',
    });
    assert.deepEqual(
      result.map(({ file, code }) => ({ file, code })),
      [
        { file: "/consumer/main.ts", code: 2322 },
        { file: "/consumer/main.ts", code: 2304 },
      ]
    );
  });

  it("retains explicit owner imports and local shadowing", () => {
    const source = "export type T = { value: number };";
    for (const main of [
      'import type { T } from "./types"; const value: T = { value: 1 };',
      'type T = string; const value: T = "local";',
    ]) {
      assert.deepEqual(
        diagnostics({
          "/owner/main.ts": main,
          "/owner/types.d.ts": source,
          "/owner/own.d.ts": buildOwnDeclarations(source),
        }),
        []
      );
    }
  });

  it("does not copy explicit global augmentations or empty export lists", () => {
    assert.equal(buildOwnDeclarations("export {};"), "");
    assert.equal(
      buildOwnDeclarations(
        "export {}; declare global { interface Window { count: number } }"
      ),
      ""
    );
  });

  it("retains namespace peers used by an exported type", () => {
    const source =
      "declare namespace Types { interface Value { label: string } }\nexport type T = Types.Value;";
    assert.deepEqual(
      diagnostics({
        "/owner/types.d.ts": source,
        "/owner/own.d.ts": buildOwnDeclarations(source),
        "/owner/main.ts":
          'const own: T = { label: "owner" }; const peer: Types.Value = own;',
      }),
      []
    );
  });
});
