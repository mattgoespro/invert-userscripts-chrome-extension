import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isModuleDeclarationFile,
  shouldMountTypesModel,
  shouldPublishAmbientTypeLib,
  stripExportsForAmbientLib,
} from "../packages/renderer/src/shared/services/ambient-type-defs.ts";

describe("isModuleDeclarationFile", () => {
  it("detects top-level export and import as modules", () => {
    assert.equal(isModuleDeclarationFile("export type Foo = string;"), true);
    assert.equal(
      isModuleDeclarationFile('import type { X } from "./x";\ntype Y = X;'),
      true
    );
  });

  it("treats ambient-only declarations as non-modules", () => {
    assert.equal(isModuleDeclarationFile("declare const foo: string;"), false);
    assert.equal(isModuleDeclarationFile("interface Foo { x: number }"), false);
  });
});

describe("shouldMountTypesModel", () => {
  it("always mounts the active types pane", () => {
    assert.equal(
      shouldMountTypesModel({
        isActive: true,
        typeDefinitions: "type Foo = string;",
      }),
      true
    );
  });

  it("mounts an offscreen types pane once it has export", () => {
    assert.equal(
      shouldMountTypesModel({
        isActive: false,
        typeDefinitions: "export type Foo = string;",
      }),
      true
    );
  });

  it("does not mount an offscreen unexported types pane", () => {
    assert.equal(
      shouldMountTypesModel({
        isActive: false,
        typeDefinitions: "type Foo = string;",
      }),
      false
    );
  });

  it("unmounts an offscreen types pane after the last export is removed", () => {
    assert.equal(
      shouldMountTypesModel({
        isActive: false,
        typeDefinitions: "type Foo = string;\n",
      }),
      false
    );
  });
});

describe("stripExportsForAmbientLib", () => {
  it("strips export from named type/interface/const declarations", () => {
    const input = [
      "export type Foo = string;",
      "export interface Bar { x: number }",
      "export const Baz = 1;",
      "export declare function qux(): void;",
    ].join("\n");

    const output = stripExportsForAmbientLib(input);

    assert.match(output, /^type Foo = string;/m);
    assert.match(output, /^interface Bar \{ x: number \}/m);
    assert.match(output, /^const Baz = 1;/m);
    assert.match(output, /^declare function qux\(\): void;/m);
    assert.doesNotMatch(output, /^export /m);
  });

  it("removes named and namespace re-exports without stripping export type { }", () => {
    const input = [
      "export type Widget = number;",
      "export type { Widget };",
      "export { Widget } from './other';",
      "export * from './star';",
      "export * as ns from './ns';",
      "declare const keep: string;",
    ].join("\n");

    const output = stripExportsForAmbientLib(input);

    assert.match(output, /^type Widget = number;/m);
    assert.match(output, /^declare const keep: string;/m);
    assert.doesNotMatch(output, /export type \{ Widget \}/);
    assert.doesNotMatch(output, /export \{ Widget \}/);
    assert.doesNotMatch(output, /export \*/);
  });

  it("unwraps declare global blocks after stripping export {}", () => {
    const input = [
      "declare global {",
      "  type PrettyStringifyOptions = { quoteStrings?: boolean };",
      "  function prettyStringify(value: unknown): string;",
      "}",
      "",
      "export {};",
    ].join("\n");

    const output = stripExportsForAmbientLib(input);

    assert.match(
      output,
      /type PrettyStringifyOptions = \{ quoteStrings\?: boolean \};/
    );
    assert.match(output, /function prettyStringify\(value: unknown\): string;/);
    assert.doesNotMatch(output, /declare\s+global/);
    assert.doesNotMatch(output, /export\s*\{\s*\}/);
  });

  it("unwraps nested braces inside declare global type literals", () => {
    const input = [
      "declare global {",
      "  type Box = { inner: { x: number } };",
      "}",
      "export {};",
    ].join("\n");

    const output = stripExportsForAmbientLib(input);

    assert.match(output, /type Box = \{ inner: \{ x: number \} \};/);
    assert.doesNotMatch(output, /declare\s+global/);
  });
});

describe("shouldPublishAmbientTypeLib", () => {
  it("publishes a stripped extra lib for the active pane when it uses export type", () => {
    assert.equal(
      shouldPublishAmbientTypeLib({
        shared: true,
        typesModeled: true,
        typeDefinitions:
          "export type PrettyStringifyOptions = { quoteStrings?: boolean };",
      }),
      true
    );
  });

  it("publishes a stripped extra lib for a non-shared active export type pane", () => {
    assert.equal(
      shouldPublishAmbientTypeLib({
        shared: false,
        typesModeled: true,
        typeDefinitions: "export type Foo = string;",
      }),
      true
    );
  });

  it("does not extra-lib an ambient (non-module) types pane that is already in the program", () => {
    assert.equal(
      shouldPublishAmbientTypeLib({
        shared: true,
        typesModeled: true,
        typeDefinitions:
          "type PrettyStringifyOptions = { quoteStrings?: boolean };",
      }),
      false
    );
  });

  it("does not extra-lib a modeled declare global module (the model already leaks globals)", () => {
    assert.equal(
      shouldPublishAmbientTypeLib({
        shared: true,
        typesModeled: true,
        typeDefinitions:
          "declare global {\n  type Foo = string;\n}\nexport {};\n",
      }),
      false
    );
  });

  it("publishes offscreen shared type panes so other userscripts still see page globals", () => {
    assert.equal(
      shouldPublishAmbientTypeLib({
        shared: true,
        typesModeled: false,
        typeDefinitions:
          "type PrettyStringifyOptions = { quoteStrings?: boolean };",
      }),
      true
    );
  });

  it("does not extra-lib unused non-shared type panes", () => {
    assert.equal(
      shouldPublishAmbientTypeLib({
        shared: false,
        typesModeled: false,
        typeDefinitions: "export type Foo = string;",
      }),
      false
    );
  });
});
