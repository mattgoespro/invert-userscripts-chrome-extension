import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCompiledCodeEntry,
  digestUserscriptCompileSources,
  hashUserscriptCompileSources,
} from "../packages/shared/src/compile-metadata.ts";
import { getScriptModulePath } from "../packages/shared/src/model.ts";
import {
  ChromeSyncStorage,
  CompiledCodeStorage,
} from "../packages/shared/src/storage/index.ts";
import {
  getCssBookmark,
  setCssBookmark,
} from "../packages/runtime/src/ide/css-bookmarks.ts";
import {
  forgetTabDocuments,
  hasDocumentStep,
  recordDocumentStep,
} from "../packages/runtime/src/ide/document-ledger.ts";
import {
  applyScriptsToMatchingTabs,
  injectMatchingScripts,
  prepareTabForInjection,
  reconcileStylesForScripts,
  removeScriptFromMatchingTabs,
} from "../packages/runtime/src/ide/scripts.ts";
import {
  buildModuleFixture,
  buildUserscriptFixture,
} from "./helpers/fixtures.mjs";

const URL = "https://example.com/";
// css-bookmarks caches this store for the life of the test process.
const session = {};
const area = (store) => ({
  get: async () => ({ ...store }),
  set: async (values) => {
    Object.assign(store, values);
  },
  remove: async () => {},
});

function manifestFor(script, imports = []) {
  return {
    version: 1,
    source: script.code.source.typescript,
    imports: imports.map((dependency) => ({
      specifier: getScriptModulePath(dependency),
      modulePath: getScriptModulePath(dependency),
      runtime: true,
      target: "main",
    })),
    diagnostics: [],
  };
}

async function artifactFor(script, javascript, css, imports) {
  return {
    ...buildCompiledCodeEntry(javascript, css, {
      minifyCompiledOutput: false,
      sourceHash: hashUserscriptCompileSources(script),
      sourceDigest: await digestUserscriptCompileSources(script),
    }),
    manifest: manifestFor(script, imports),
  };
}

/** Runs `body` against mocked Chrome and storage; every tab shows `frames[tabId]`. */
async function withRuntime({ tabs, scripts, artifacts, modules = {} }, body) {
  const frames = Object.fromEntries(
    tabs.map((tab) => [tab.id, { documentId: "doc-" + tab.id, url: tab.url }])
  );
  const h = {
    frames,
    artifacts,
    scripts,
    executed: [],
    inserted: [],
    removed: [],
    frameReads: 0,
    execute: async ({ js }) => {
      h.executed.push(js[0].code);
      return [{ result: true }];
    },
    insertCSS: async ({ target, css }) => {
      h.inserted.push({ tabId: target.tabId, doc: target.documentIds[0], css });
    },
    removeCSS: async ({ target, css }) => {
      h.removed.push({ tabId: target.tabId, doc: target.documentIds[0], css });
    },
    local: {},
  };
  const previous = {
    chrome: globalThis.chrome,
    fetch: globalThis.fetch,
    log: console.log,
    error: console.error,
  };
  const reads = [
    ChromeSyncStorage.getAllScripts,
    ChromeSyncStorage.getAllModules,
    ChromeSyncStorage.getEditorSettings,
    CompiledCodeStorage.getAllCompiledCode,
    CompiledCodeStorage.getCompiledCode,
  ];
  globalThis.chrome = {
    storage: { session: area(session), local: area(h.local) },
    tabs: { query: async () => tabs },
    webNavigation: {
      getFrame: async ({ tabId }) => {
        h.frameReads++;
        if (!h.frames[tabId]) {
          throw new Error("No tab with id: " + tabId);
        }
        return h.frames[tabId];
      },
    },
    scripting: {
      insertCSS: (request) => h.insertCSS(request),
      removeCSS: (request) => h.removeCSS(request),
    },
    userScripts: {
      getScripts: async () => [],
      execute: (request) => h.execute(request),
    },
  };
  globalThis.fetch = async (url) => new Response("/* cdn */ " + url);
  console.log = () => {};
  console.error = () => {};
  ChromeSyncStorage.getAllScripts = async () => structuredClone(h.scripts);
  ChromeSyncStorage.getAllModules = async () => modules;
  ChromeSyncStorage.getEditorSettings = async () => ({
    minifyCompiledOutput: false,
  });
  CompiledCodeStorage.getAllCompiledCode = async () =>
    structuredClone(h.artifacts);
  CompiledCodeStorage.getCompiledCode = async (id) =>
    structuredClone(h.artifacts[id] ?? null);
  try {
    await body(h);
  } finally {
    [
      ChromeSyncStorage.getAllScripts,
      ChromeSyncStorage.getAllModules,
      ChromeSyncStorage.getEditorSettings,
      CompiledCodeStorage.getAllCompiledCode,
      CompiledCodeStorage.getCompiledCode,
    ] = reads;
    globalThis.chrome = previous.chrome;
    globalThis.fetch = previous.fetch;
    console.log = previous.log;
    console.error = previous.error;
  }
}

const cssScript = (id, overrides = {}) =>
  buildUserscriptFixture({
    id,
    moduleName: id,
    urlPatterns: ["*"],
    ...overrides,
  });

async function cssRuntime(tabs, id = "styled") {
  const script = cssScript(id);
  return {
    tabs,
    scripts: { [id]: script },
    artifacts: { [id]: await artifactFor(script, "", "body{color:red}") },
  };
}

test("same-document loading keeps CSS bookmarks; a new document or closed tab drops them", async () => {
  const tabs = [{ id: 201, url: URL }];
  await withRuntime(await cssRuntime(tabs), async (h) => {
    await prepareTabForInjection(201);
    await setCssBookmark(201, "styled", "css", "doc-201");
    await prepareTabForInjection(201);
    assert.equal(await getCssBookmark(201, "styled"), "css");

    h.frames[201] = { documentId: "doc-201b", url: URL };
    await prepareTabForInjection(201);
    assert.equal(await getCssBookmark(201, "styled"), undefined);

    await setCssBookmark(201, "styled", "css", "doc-201b");
    delete h.frames[201];
    await prepareTabForInjection(201);
    assert.equal(await getCssBookmark(201, "styled"), undefined);
  });
});

test("a first observation after a worker restart keeps the current document's bookmark", async () => {
  await withRuntime(await cssRuntime([{ id: 202, url: URL }]), async () => {
    await setCssBookmark(202, "styled", "css", "doc-202");
    await prepareTabForInjection(202);
    assert.equal(await getCssBookmark(202, "styled"), "css");
  });
});

test("an SPA route change does not fail an in-flight injection", async () => {
  const first = buildUserscriptFixture({ id: "first", moduleName: "first" });
  const second = buildUserscriptFixture({ id: "second", moduleName: "second" });
  await withRuntime(
    {
      tabs: [{ id: 203, url: URL }],
      scripts: { first, second },
      artifacts: {
        first: await artifactFor(first, "first();", ""),
        second: await artifactFor(second, "second();", ""),
      },
    },
    async (h) => {
      await prepareTabForInjection(203);
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      let entered;
      const started = new Promise((resolve) => {
        entered = resolve;
      });
      const execute = h.execute;
      h.execute = async (request) => {
        entered();
        await gate;
        return execute(request);
      };
      const injecting = injectMatchingScripts(203, URL, "afterPageLoad");
      await started;
      await prepareTabForInjection(203);
      release();
      await injecting;
      assert.equal(h.executed.length, 2);
    }
  );
});

test("stylesheet reconciliation treats restricted, discarded and denied tabs as nothing to do", async () => {
  const tabs = [
    { id: 211, url: "https://chromewebstore.google.com/detail/example" },
    { id: 212, url: URL, discarded: true },
    { id: 213, url: "https://denied.example/" },
    { id: 214, url: URL },
  ];
  await withRuntime(await cssRuntime(tabs), async (h) => {
    const insertCSS = h.insertCSS;
    h.insertCSS = async (request) => {
      if (request.target.tabId === 213) {
        throw new Error("Cannot access contents of the page.");
      }
      return insertCSS(request);
    };
    await reconcileStylesForScripts(["styled"]);
    assert.deepEqual(
      h.inserted.map((entry) => entry.tabId),
      [214]
    );
  });
});

test("reconciliation still reports a target failure that can succeed on retry", async () => {
  await withRuntime(await cssRuntime([{ id: 215, url: URL }]), async (h) => {
    h.insertCSS = async () => {
      throw new Error("temporary failure");
    };
    await assert.rejects(
      () => reconcileStylesForScripts(["styled"]),
      /temporary failure/
    );
  });
});

test("a late bookmark from the previous document cannot make the new one skip its CSS", async () => {
  await withRuntime(await cssRuntime([{ id: 221, url: URL }]), async (h) => {
    await setCssBookmark(221, "styled", "body{color:red}", "doc-previous");
    await reconcileStylesForScripts(["styled"]);
    assert.deepEqual(h.inserted, [
      { tabId: 221, doc: "doc-221", css: "body{color:red}" },
    ]);
    assert.deepEqual(h.removed, []);
    await reconcileStylesForScripts(["styled"]);
    assert.equal(h.inserted.length, 1, "identical re-apply stays a no-op");
  });
});

test("disable cleanup survives a failing tab and skips pinning tabs with no bookmark", async () => {
  const tabs = [
    { id: 231, url: URL },
    { id: 232, url: URL },
    { id: 233, url: URL },
  ];
  const runtime = await cssRuntime(tabs, "disabled");
  runtime.scripts.disabled.enabled = false;
  await withRuntime(runtime, async (h) => {
    await setCssBookmark(231, "disabled", "css", "doc-231");
    await setCssBookmark(232, "disabled", "css", "doc-232");
    const removeCSS = h.removeCSS;
    h.removeCSS = async (request) => {
      if (request.target.tabId === 231) {
        throw new Error("removal failure");
      }
      return removeCSS(request);
    };
    assert.deepEqual(await removeScriptFromMatchingTabs("disabled"), {
      removedTabCount: 1,
      failedTabCount: 1,
    });
    assert.deepEqual(
      h.removed.map((entry) => entry.tabId),
      [232]
    );
    assert.equal(await getCssBookmark(231, "disabled"), "css");
    // 231 re-reads the frame after the failed removal; 233 must not be pinned.
    assert.equal(h.frameReads, 3);
  });
});

async function sharedRuntime(tabId) {
  const shared = buildUserscriptFixture({
    id: "shared-" + tabId,
    moduleName: "shared-" + tabId,
    shared: true,
  });
  const library = buildModuleFixture({
    id: "lib-" + tabId,
    url: "https://cdn.example.com/lib-" + tabId + ".js",
  });
  const consumer = (id, runAt) =>
    buildUserscriptFixture({
      id,
      moduleName: id,
      runAt,
      globalModules: [library.id],
      code: { source: { typescript: 'import "' + id + '";' } },
    });
  const before = consumer("before-" + tabId, "beforePageLoad");
  const after = consumer("after-" + tabId, "afterPageLoad");
  return {
    tabs: [{ id: tabId, url: URL }],
    modules: { [library.id]: library },
    scripts: {
      [shared.id]: shared,
      [before.id]: before,
      [after.id]: after,
    },
    artifacts: {
      [shared.id]: await artifactFor(shared, "sharedRun();", ""),
      [before.id]: await artifactFor(before, "beforeRun();", "", [shared]),
      [after.id]: await artifactFor(after, "afterRun();", "", [shared]),
    },
  };
}
const count = (executed, needle) =>
  executed.filter((code) => code.includes(needle)).length;

test("a shared module and CDN library run once across a document's load phases", async () => {
  await withRuntime(await sharedRuntime(241), async (h) => {
    await injectMatchingScripts(241, URL, "beforePageLoad");
    await injectMatchingScripts(241, URL, "afterPageLoad");
    assert.equal(count(h.executed, "sharedRun"), 1);
    assert.equal(count(h.executed, "lib-241.js"), 1);
    assert.equal(count(h.executed, "beforeRun"), 1);
    assert.equal(count(h.executed, "afterRun"), 1);

    h.frames[241] = { documentId: "doc-241b", url: URL };
    await injectMatchingScripts(241, URL, "beforePageLoad");
    assert.equal(count(h.executed, "sharedRun"), 2, "a new document runs it");
  });
});

test("explicit apply reruns consumers once each, and an edited shared module", async () => {
  const runtime = await sharedRuntime(242);
  await withRuntime(runtime, async (h) => {
    await applyScriptsToMatchingTabs(["before-242", "after-242"]);
    assert.equal(count(h.executed, "sharedRun"), 1);
    assert.equal(count(h.executed, "lib-242.js"), 1);

    await applyScriptsToMatchingTabs(["before-242", "after-242"]);
    assert.equal(count(h.executed, "beforeRun"), 2);
    assert.equal(count(h.executed, "sharedRun"), 1);

    h.artifacts["shared-242"].javascript = "sharedRunEdited();";
    await applyScriptsToMatchingTabs(["before-242"]);
    assert.equal(count(h.executed, "sharedRunEdited"), 1);
  });
});

test("a failed shared module is not recorded and runs again next time", async () => {
  await withRuntime(await sharedRuntime(243), async (h) => {
    const execute = h.execute;
    h.execute = async () => [{ error: "boom" }];
    await injectMatchingScripts(243, URL, "beforePageLoad");
    h.execute = execute;
    await injectMatchingScripts(243, URL, "afterPageLoad");
    assert.equal(count(h.executed, "lib-243.js"), 1);
    assert.equal(count(h.executed, "sharedRun"), 1);
  });
});

test("transactional navigation runs each load phase once per document", async () => {
  await withRuntime(await sharedRuntime(244), async (h) => {
    h.local.publicationBackend = "transactional";
    await injectMatchingScripts(244, URL, "beforePageLoad");
    await injectMatchingScripts(244, URL, "beforePageLoad");
    assert.equal(count(h.executed, "beforeRun"), 1);
    h.frames[244] = { documentId: "doc-244b", url: URL };
    await injectMatchingScripts(244, URL, "beforePageLoad");
    assert.equal(count(h.executed, "beforeRun"), 2);
  });
});

test("the document ledger stays bounded per tab and is released with the tab", async () => {
  await withRuntime(await cssRuntime([{ id: 251, url: URL }]), async () => {
    for (let index = 0; index < 40; index++) {
      assert.equal(await recordDocumentStep(251, "d" + index, "step"), true);
    }
    assert.equal(await recordDocumentStep(251, "d39", "step"), false);
    assert.equal(await hasDocumentStep("d0", "step"), false);
    assert.equal(await hasDocumentStep("d39", "step"), true);
    await recordDocumentStep(252, "other", "step");
    await forgetTabDocuments(251);
    assert.equal(await hasDocumentStep("d39", "step"), false);
    assert.equal(await hasDocumentStep("other", "step"), true);
  });
});
