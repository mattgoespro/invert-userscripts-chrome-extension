import assert from "node:assert/strict";
import test from "node:test";
import {
  ChromeSyncStorage,
  CompiledCodeStorage,
} from "../packages/shared/src/storage/index.ts";
import {
  countMatchingScripts,
  updateBadgeForTab,
} from "../packages/runtime/src/ide/badge.ts";
import { selectMatchingScriptsForInjection } from "../packages/runtime/src/ide/injection-plan.ts";
import {
  injectMatchingScripts,
  applyScriptsToMatchingTabs,
  removeScriptFromMatchingTabs,
} from "../packages/runtime/src/ide/scripts.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

const restrictedUrls = [
  "chrome://settings/",
  "chrome://extensions/",
  "chrome-extension://example/options.html",
  "devtools://devtools/bundled/inspector.html",
  "about:blank",
  "data:text/html,hello",
  "https://chromewebstore.google.com/detail/example",
  "https://chrome.google.com/webstore/detail/example",
  "invalid",
];
const script = buildUserscriptFixture({
  id: "wildcard",
  enabled: true,
  urlPatterns: ["*"],
  runAt: "afterPageLoad",
});

test("wildcard scripts never match browser-owned or store pages for execution or badges", () => {
  for (const url of restrictedUrls) {
    assert.equal(countMatchingScripts(url, { wildcard: script }), 0, url);
    assert.deepEqual(
      selectMatchingScriptsForInjection(
        { wildcard: script },
        url,
        "afterPageLoad"
      ),
      [],
      url
    );
  }
  for (const url of [
    "http://localhost/",
    "https://example.com/",
    "file:///C:/test.html",
    "https://chrome.google.com/webstore-other",
  ]) {
    assert.equal(countMatchingScripts(url, { wildcard: script }), 1, url);
  }
});

test("restricted navigation is a silent no-op before document pinning", async () => {
  const previousChrome = globalThis.chrome;
  const previousError = console.error;
  let frameReads = 0;
  const errors = [];
  globalThis.chrome = {
    webNavigation: {
      getFrame: async () => {
        frameReads++;
        return null;
      },
    },
  };
  console.error = (...args) => errors.push(args);
  try {
    for (const url of restrictedUrls) {
      await injectMatchingScripts(1, url, "afterPageLoad", {
        scriptsMap: { wildcard: script },
        minifyCompiledOutput: false,
      });
    }
    assert.equal(frameReads, 0);
    assert.deepEqual(errors, []);
  } finally {
    globalThis.chrome = previousChrome;
    console.error = previousError;
  }
});

test("explicit apply and disabled-script CSS cleanup skip restricted tabs", async () => {
  const previousChrome = globalThis.chrome;
  const previousError = console.error;
  const reads = [
    ChromeSyncStorage.getAllScripts,
    ChromeSyncStorage.getAllModules,
    ChromeSyncStorage.getEditorSettings,
    CompiledCodeStorage.getAllCompiledCode,
  ];
  let frameReads = 0;
  let enabled = true;
  globalThis.chrome = {
    webNavigation: {
      getFrame: async () => {
        frameReads++;
        return null;
      },
    },
    tabs: {
      query: async () =>
        restrictedUrls.map((url, index) => ({ id: index + 1, url })),
    },
  };
  ChromeSyncStorage.getAllScripts = async () => ({
    wildcard: { ...script, enabled },
  });
  ChromeSyncStorage.getAllModules = async () => ({});
  ChromeSyncStorage.getEditorSettings = async () => ({});
  CompiledCodeStorage.getAllCompiledCode = async () => ({});
  console.error = () => {};
  try {
    assert.deepEqual(await applyScriptsToMatchingTabs([script.id]), {
      success: true,
      appliedTabCount: 0,
      staleSkipCount: 0,
    });
    enabled = false;
    assert.deepEqual(await removeScriptFromMatchingTabs(script.id), {
      removedTabCount: 0,
    });
    assert.equal(frameReads, 0);
  } finally {
    [
      ChromeSyncStorage.getAllScripts,
      ChromeSyncStorage.getAllModules,
      ChromeSyncStorage.getEditorSettings,
      CompiledCodeStorage.getAllCompiledCode,
    ] = reads;
    globalThis.chrome = previousChrome;
    console.error = previousError;
  }
});

test("restricted tabs get a grey no-op badge without storage reads and normal tabs restore their count", async () => {
  const previousChrome = globalThis.chrome;
  const previousRead = ChromeSyncStorage.getAllScripts;
  const state = {};
  let reads = 0;
  globalThis.chrome = {
    action: {
      setBadgeText: async (value) => {
        state.text = value.text;
      },
      setBadgeBackgroundColor: async (value) => {
        state.color = value.color;
      },
      setTitle: async (value) => {
        state.title = value.title;
      },
    },
  };
  ChromeSyncStorage.getAllScripts = async () => {
    reads++;
    return { wildcard: script };
  };
  try {
    await updateBadgeForTab(1, "chrome://settings/");
    assert.equal(reads, 0);
    assert.equal(state.text, "–");
    assert.equal(state.color, "#6B7280");
    assert.match(state.title, /Scripts cannot run on this page/);
    await updateBadgeForTab(1, "https://example.com/");
    assert.equal(state.text, "1");
    assert.equal(state.color, "#FBBF24");
    assert.equal(state.title, "Invert IDE Userscripts");
  } finally {
    ChromeSyncStorage.getAllScripts = previousRead;
    globalThis.chrome = previousChrome;
  }
});
