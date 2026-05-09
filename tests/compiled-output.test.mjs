import assert from "node:assert/strict";
import test from "node:test";
import {
  getSharedImportModuleNames,
  prepareCompiledJavascript,
} from "../packages/shared/src/compiled-output.ts";

test("getSharedImportModuleNames ignores type-only imports", () => {
  const sourceCode = [
    'import type { Foo } from "shared/types-only";',
    'import defaultValue, { helper as renamedHelper } from "shared/runtime";',
    'import "shared/side-effects";',
  ].join("\n");

  assert.deepEqual(getSharedImportModuleNames(sourceCode), [
    "runtime",
    "side-effects",
  ]);
});

test("prepareCompiledJavascript rewrites shared imports without metadata", () => {
  const compiledJavascript = [
    'import defaultValue, { helper as renamedHelper } from "shared/runtime";',
    'import * as namespaceImport from "shared/namespace";',
    'import "shared/side-effects";',
    'console.log(defaultValue, renamedHelper, namespaceImport);',
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
  assert.match(
    result,
    /window\.__INVERT_SHARED__\["side-effects"\];/
  );
});