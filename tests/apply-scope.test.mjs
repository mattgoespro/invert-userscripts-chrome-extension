import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandAffectedScriptIds } from "../packages/shared/src/apply-scope.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

describe("expandAffectedScriptIds", () => {
  it("returns only the seed script when nothing depends on it", () => {
    const scriptsMap = {
      a: buildUserscriptFixture({ id: "a", sharedScripts: [] }),
      b: buildUserscriptFixture({ id: "b", sharedScripts: [] }),
    };

    assert.deepEqual(expandAffectedScriptIds(["a"], scriptsMap), ["a"]);
  });

  it("includes consumers of a shared module via sharedScripts cache", () => {
    const scriptsMap = {
      shared: buildUserscriptFixture({
        id: "shared",
        shared: true,
        moduleName: "shared",
        sharedScripts: [],
      }),
      consumer: buildUserscriptFixture({
        id: "consumer",
        sharedScripts: ["shared"],
      }),
      other: buildUserscriptFixture({ id: "other", sharedScripts: [] }),
    };

    const result = expandAffectedScriptIds(["shared"], scriptsMap).sort();
    assert.deepEqual(result, ["consumer", "shared"]);
  });

  it("includes nested consumers via fixpoint expansion", () => {
    const scriptsMap = {
      leaf: buildUserscriptFixture({
        id: "leaf",
        shared: true,
        moduleName: "leaf",
        sharedScripts: [],
      }),
      mid: buildUserscriptFixture({
        id: "mid",
        shared: true,
        moduleName: "mid",
        sharedScripts: ["leaf"],
      }),
      top: buildUserscriptFixture({
        id: "top",
        sharedScripts: ["mid"],
      }),
    };

    const result = expandAffectedScriptIds(["leaf"], scriptsMap).sort();
    assert.deepEqual(result, ["leaf", "mid", "top"]);
  });

  it("includes nested consumers discovered from TypeScript imports", () => {
    const scriptsMap = {
      leaf: buildUserscriptFixture({
        id: "leaf",
        shared: true,
        moduleName: "leaf",
        sharedScripts: [],
        code: { source: { typescript: "export const leaf = 1;" } },
      }),
      mid: buildUserscriptFixture({
        id: "mid",
        shared: true,
        moduleName: "mid",
        sharedScripts: [],
        code: {
          source: {
            typescript:
              'import { leaf } from "scripts/leaf/main"; export const mid = leaf;',
          },
        },
      }),
      top: buildUserscriptFixture({
        id: "top",
        sharedScripts: [],
        code: {
          source: {
            typescript:
              'import { mid } from "scripts/mid/main"; console.log(mid);',
          },
        },
      }),
    };

    const result = expandAffectedScriptIds(["leaf"], scriptsMap).sort();
    assert.deepEqual(result, ["leaf", "mid", "top"]);
  });

  it("ignores unknown script ids", () => {
    const scriptsMap = {
      a: buildUserscriptFixture({ id: "a", sharedScripts: [] }),
    };

    assert.deepEqual(expandAffectedScriptIds(["missing"], scriptsMap), []);
  });
});
