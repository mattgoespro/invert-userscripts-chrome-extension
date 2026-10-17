import assert from "node:assert/strict";
import test from "node:test";
import { analyzeModule } from "../packages/renderer/src/sandbox/module-analysis.ts";
import {
  resolveModuleGraph,
  affectedConsumers,
} from "../packages/shared/src/modules/graph.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

test("analysis ignores comments and erased imports while preserving multiline value bindings", () => {
  const manifest = analyzeModule(`
    // import { fake } from "scripts/fake/main";
    import type { Shape } from "scripts/types/types";
    import {
      type Hidden,
      value as renamed
    } from "scripts/helper/main";
    import "scripts/init/main";
    const text = 'import x from "scripts/fake/main"';
  `);
  assert.deepEqual(
    manifest.imports.map(({ specifier, runtime }) => [specifier, runtime]),
    [
      ["scripts/types/types", false],
      ["scripts/helper/main", true],
      ["scripts/init/main", true],
    ]
  );
});
test("graph orders dependencies and reports cycles and non-shared runtime references", () => {
  const scripts = {
    a: buildUserscriptFixture({ id: "a", shared: true, moduleName: "a" }),
    b: buildUserscriptFixture({ id: "b", shared: true, moduleName: "b" }),
    c: buildUserscriptFixture({ id: "c", shared: false, moduleName: "" }),
  };
  const manifests = {
    a: analyzeModule('import { b } from "scripts/b/main";'),
    b: analyzeModule('import "scripts/a/main";'),
    c: analyzeModule('import "scripts/c/main";'),
  };
  for (const id of Object.keys(scripts)) {
    scripts[id].code.source.typescript = manifests[id].source;
  }
  const graph = resolveModuleGraph(["a", "c"], scripts, manifests);
  assert.ok(graph.errors.some((error) => error.kind === "cycle"));
  assert.ok(graph.errors.some((error) => error.kind === "not-shared"));
  scripts.b.code.source.typescript = "";
  assert.deepEqual(
    resolveModuleGraph(["a"], scripts, { a: manifests.a, b: analyzeModule("") })
      .orderedIds,
    ["b", "a"]
  );
});
test("analysis marks unsupported dynamic imports and re-exports explicitly", () => {
  assert.equal(
    analyzeModule('const x = import("scripts/a/main")').diagnostics[0].kind,
    "dynamic-import"
  );
  assert.equal(
    analyzeModule('export { x } from "scripts/a/main"').diagnostics[0].kind,
    "re-export"
  );
  assert.deepEqual(
    analyzeModule('export type { X } from "scripts/a/types";').diagnostics,
    []
  );
});
test("affected consumers follow multiline runtime edges and ignore type-only edges", () => {
  const scripts = {
    a: buildUserscriptFixture({ id: "a", moduleName: "a", shared: true }),
    b: buildUserscriptFixture({ id: "b", moduleName: "b", shared: true }),
    c: buildUserscriptFixture({ id: "c", moduleName: "c" }),
  };
  const manifests = {
    a: analyzeModule(""),
    b: analyzeModule('import {\n x\n } from "scripts/a/main";'),
    c: analyzeModule('import type {X} from "scripts/a/types";'),
  };
  assert.deepEqual(affectedConsumers(["a"], scripts, manifests), ["a", "b"]);
});
