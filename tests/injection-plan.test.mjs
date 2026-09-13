import assert from "node:assert/strict";
import test from "node:test";
import {
  collectCompiledCodeScriptIds,
  collectEnabledCdnModuleIds,
  collectSharedScriptIdsToInject,
  mergeCompiledCode,
  selectMatchingScriptsForInjection,
  sharedDependenciesAreFresh,
} from "../packages/runtime/src/ide/injection-plan.ts";
import {
  buildModuleFixture,
  buildUserscriptFixture,
} from "./helpers/fixtures.mjs";

test("selectMatchingScriptsForInjection requires enabled + runAt + URL match", () => {
  const scriptsMap = {
    match: buildUserscriptFixture({
      id: "match",
      enabled: true,
      runAt: "afterPageLoad",
      urlPatterns: ["https://example.com/*"],
    }),
    disabled: buildUserscriptFixture({
      id: "disabled",
      enabled: false,
      runAt: "afterPageLoad",
      urlPatterns: ["https://example.com/*"],
    }),
    wrongTiming: buildUserscriptFixture({
      id: "wrongTiming",
      enabled: true,
      runAt: "beforePageLoad",
      urlPatterns: ["https://example.com/*"],
    }),
    wrongHost: buildUserscriptFixture({
      id: "wrongHost",
      enabled: true,
      runAt: "afterPageLoad",
      urlPatterns: ["https://other.example.com/*"],
    }),
  };

  const matching = selectMatchingScriptsForInjection(
    scriptsMap,
    "https://example.com/page",
    "afterPageLoad"
  );

  assert.deepEqual(
    matching.map((script) => script.id),
    ["match"]
  );
});

test("selectMatchingScriptsForInjection excludes shared modules", () => {
  const scriptsMap = {
    page: buildUserscriptFixture({
      id: "page",
      enabled: true,
      shared: false,
      runAt: "afterPageLoad",
      urlPatterns: ["https://example.com/*"],
    }),
    lib: buildUserscriptFixture({
      id: "lib",
      enabled: true,
      shared: true,
      moduleName: "lib",
      runAt: "afterPageLoad",
      urlPatterns: ["https://example.com/*"],
    }),
  };

  const matching = selectMatchingScriptsForInjection(
    scriptsMap,
    "https://example.com/page",
    "afterPageLoad"
  );

  assert.deepEqual(
    matching.map((script) => script.id),
    ["page"]
  );
});

test("collectCompiledCodeScriptIds includes shared dependency ids", () => {
  const sharedA = buildUserscriptFixture({
    id: "shared-a",
    shared: true,
    moduleName: "shared-a",
    code: { source: { typescript: "export const a = 1;" } },
  });
  const sharedB = buildUserscriptFixture({
    id: "shared-b",
    shared: true,
    moduleName: "shared-b",
    code: { source: { typescript: "export const b = 1;" } },
  });
  const page = buildUserscriptFixture({
    id: "page",
    code: {
      source: {
        typescript: [
          'import { a } from "scripts/shared-a/main";',
          'import { b } from "scripts/shared-b/main";',
        ].join("\n"),
      },
    },
  });
  const other = buildUserscriptFixture({
    id: "other",
    code: {
      source: {
        typescript: 'import { a } from "scripts/shared-a/main";',
      },
    },
  });
  const scriptsMap = {
    page,
    other,
    "shared-a": sharedA,
    "shared-b": sharedB,
  };

  const ids = collectCompiledCodeScriptIds([page, other], scriptsMap).sort();

  assert.deepEqual(ids, ["other", "page", "shared-a", "shared-b"]);
});

test("mergeCompiledCode overlays local compiled payloads and keeps missing fields", () => {
  const script = buildUserscriptFixture({
    id: "script-1",
    code: {
      compiled: {
        javascript: "manifestJs()",
        css: "manifestCss{}",
      },
    },
  });

  assert.equal(mergeCompiledCode(script, {}), script);

  const merged = mergeCompiledCode(script, {
    "script-1": {
      javascript: "localJs()",
      css: "",
    },
  });

  assert.equal(merged.code.compiled.javascript, "localJs()");
  assert.equal(merged.code.compiled.css, "manifestCss{}");
  assert.notEqual(merged, script);
});

test("collectEnabledCdnModuleIds dedupes and skips disabled/missing modules", () => {
  const scripts = [
    buildUserscriptFixture({
      id: "a",
      globalModules: ["mod-1", "mod-2", "missing"],
    }),
    buildUserscriptFixture({
      id: "b",
      globalModules: ["mod-2", "mod-3"],
    }),
  ];
  const modulesMap = {
    "mod-1": buildModuleFixture({ id: "mod-1", enabled: true }),
    "mod-2": buildModuleFixture({ id: "mod-2", enabled: false }),
    "mod-3": buildModuleFixture({ id: "mod-3", enabled: true }),
  };

  assert.deepEqual(collectEnabledCdnModuleIds(scripts, modulesMap), [
    "mod-1",
    "mod-3",
  ]);
});

test("collectSharedScriptIdsToInject keeps first-seen order and ignores non-shared entries", () => {
  const pageA = buildUserscriptFixture({
    id: "page-a",
    code: {
      source: {
        typescript: [
          'import "scripts/shared-1/main";',
          'import "scripts/shared-2/main";',
        ].join("\n"),
      },
    },
  });
  const pageB = buildUserscriptFixture({
    id: "page-b",
    code: {
      source: {
        typescript: [
          'import "scripts/shared-2/main";',
          'import "scripts/shared-1/main";',
        ].join("\n"),
      },
    },
  });
  const scriptsMap = {
    "page-a": pageA,
    "page-b": pageB,
    "shared-1": buildUserscriptFixture({
      id: "shared-1",
      shared: true,
      moduleName: "shared-1",
    }),
    "shared-2": buildUserscriptFixture({
      id: "shared-2",
      shared: true,
      moduleName: "shared-2",
    }),
    "not-shared": buildUserscriptFixture({
      id: "not-shared",
      shared: false,
      moduleName: "not-shared",
    }),
  };

  assert.deepEqual(collectSharedScriptIdsToInject([pageA, pageB], scriptsMap), [
    "shared-1",
    "shared-2",
  ]);
});

test("collectSharedScriptIdsToInject walks nested shared imports", () => {
  const leaf = buildUserscriptFixture({
    id: "leaf",
    shared: true,
    moduleName: "leaf",
    code: { source: { typescript: "export const leaf = 1;" } },
  });
  const mid = buildUserscriptFixture({
    id: "mid",
    shared: true,
    moduleName: "mid",
    code: {
      source: {
        typescript:
          'import { leaf } from "scripts/leaf/main"; export const mid = leaf;',
      },
    },
  });
  const page = buildUserscriptFixture({
    id: "page",
    code: {
      source: {
        typescript: 'import { mid } from "scripts/mid/main"; console.log(mid);',
      },
    },
  });
  const scriptsMap = { leaf, mid, page };

  assert.deepEqual(collectSharedScriptIdsToInject([page], scriptsMap), [
    "leaf",
    "mid",
  ]);
});

test("sharedDependenciesAreFresh is false when a nested shared import is missing", () => {
  const mid = buildUserscriptFixture({
    id: "mid",
    shared: true,
    moduleName: "mid",
    code: {
      source: {
        typescript:
          'import { leaf } from "scripts/leaf/main"; export const mid = 1;',
      },
    },
  });
  const page = buildUserscriptFixture({
    id: "page",
    code: {
      source: {
        typescript: 'import { mid } from "scripts/mid/main";',
      },
    },
  });
  const scriptsMap = { mid, page };

  assert.equal(sharedDependenciesAreFresh(page, scriptsMap, {}), false);
});
