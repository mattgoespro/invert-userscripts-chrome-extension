import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareCompiledJavascript,
  wrapSharedScriptForInjection,
} from "../packages/shared/src/compiled-output.ts";

test("prepareCompiledJavascript rewrites scripts/*/main imports to __INVERT_SHARED__", () => {
  const compiledJavascript = [
    'import defaultValue, { helper as renamedHelper } from "scripts/runtime/main";',
    'import * as namespaceImport from "scripts/namespace/main";',
    'import "scripts/side-effects/main";',
    "console.log(defaultValue, renamedHelper, namespaceImport);",
  ].join("\n");

  const result = prepareCompiledJavascript(compiledJavascript, {});

  assert.match(
    result,
    /const defaultValue = window\.__INVERT_SHARED__\["runtime"\]\["default"\];/
  );
  assert.match(
    result,
    /const \{ helper: renamedHelper \} = window\.__INVERT_SHARED__\["runtime"\];/
  );
  assert.match(
    result,
    /const namespaceImport = window\.__INVERT_SHARED__\["namespace"\];/
  );
  assert.match(result, /window\.__INVERT_SHARED__\["side-effects"\];/);
  assert.match(
    result,
    /console\.log\(defaultValue, renamedHelper, namespaceImport\);/
  );
});

test("prepareCompiledJavascript strips page-script exports for classic injection", () => {
  const result = prepareCompiledJavascript("export const value = 1;", {});

  assert.match(result, /const value = 1;/);
  assert.doesNotMatch(result, /\bexport\b/);
});

test("prepareCompiledJavascript strips type-only imports", () => {
  const result = prepareCompiledJavascript(
    'import type { Foo } from "scripts/types-only/main";\nconst value = 1;',
    {}
  );

  assert.doesNotMatch(result, /\bimport\b/);
  assert.match(result, /const value = 1;/);
});

test("prepareCompiledJavascript strips bare CDN/npm imports used for types", () => {
  const result = prepareCompiledJavascript(
    [
      'import WebFont from "webfontloader";',
      'import $ from "jquery";',
      "WebFont.load({});",
      "$.ready();",
    ].join("\n"),
    {}
  );

  assert.doesNotMatch(result, /\bimport\b/);
  assert.match(result, /WebFont\.load\(\{\}\);/);
  assert.match(result, /\$\.ready\(\);/);
});

test("prepareCompiledJavascript rejects leftover relative imports", () => {
  assert.throws(
    () => prepareCompiledJavascript('import { helper } from "./relative";', {}),
    /Unsupported import "\.\/relative"/
  );
});

test("prepareCompiledJavascript rejects dynamic import()", () => {
  assert.throws(
    () => prepareCompiledJavascript('import("scripts/runtime/main");', {}),
    /Dynamic import/
  );
});

test("prepareCompiledJavascript rejects import.meta", () => {
  assert.throws(
    () => prepareCompiledJavascript("const url = import.meta.url;", {}),
    /import\.meta/
  );
});

test("prepareCompiledJavascript also rewrites scripts/*/types value imports", () => {
  const result = prepareCompiledJavascript(
    'import { named } from "scripts/runtime/types";',
    {}
  );

  assert.match(
    result,
    /const \{ named \} = window\.__INVERT_SHARED__\["runtime"\];/
  );
});

test("wrapSharedScriptForInjection exposes named and default exports on __INVERT_SHARED__", () => {
  const compiledJs = [
    "export const helper = 1;",
    "export default function main() { return helper; }",
  ].join("\n");

  const result = wrapSharedScriptForInjection("runtime", compiledJs);

  assert.match(
    result,
    /window\.__INVERT_SHARED__=window\.__INVERT_SHARED__\|\|\{\};/
  );
  assert.match(result, /__ns__\["helper"\]=helper/);
  assert.match(result, /__ns__\["default"\]=main/);
  assert.match(result, /window\.__INVERT_SHARED__\["runtime"\]=__ns__;/);
  assert.doesNotMatch(result, /\bexport\b/);
});

test("wrapSharedScriptForInjection rejects re-exports from other modules", () => {
  assert.throws(
    () =>
      wrapSharedScriptForInjection(
        "runtime",
        'export { helper } from "scripts/other/main";'
      ),
    /re-export.*not supported/i
  );
});

test("prepareCompiledJavascript wraps shared modules when requested", () => {
  const result = prepareCompiledJavascript("export const answer = 42;", {
    shared: true,
    moduleName: "math",
  });

  assert.match(result, /window\.__INVERT_SHARED__\["math"\]=__ns__;/);
  assert.match(result, /__ns__\["answer"\]=answer/);
});

test("prepareCompiledJavascript converts anonymous default exports into classic expressions", () => {
  const result = prepareCompiledJavascript(
    "export default function() { return 1; }",
    {}
  );

  assert.match(result, /void function\(\) \{ return 1; \}/);
  assert.doesNotMatch(result, /\bexport\b/);

  const classResult = prepareCompiledJavascript("export default class {}", {});
  assert.match(classResult, /void class \{\}/);
  assert.doesNotMatch(classResult, /\bexport\b/);
});

test("prepareCompiledJavascript wraps top-level await for classic injection", () => {
  const result = prepareCompiledJavascript(
    "export const value = await Promise.resolve(1);",
    {}
  );

  assert.match(result, /^\(async \(\) => \{/);
  assert.match(result, /const value = await Promise\.resolve\(1\);/);
  assert.doesNotMatch(result, /\bexport\b/);
});

test("prepareCompiledJavascript wraps shared modules with top-level await in an async IIFE", () => {
  const result = prepareCompiledJavascript(
    "export const value = await Promise.resolve(42);",
    { shared: true, moduleName: "math" }
  );

  assert.match(result, /^\(async function\(\)\{/);
  assert.match(result, /window\.__INVERT_SHARED__\["math"\]=__ns__;/);
  assert.match(result, /await Promise\.resolve\(42\)/);
});
