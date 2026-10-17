import assert from "node:assert/strict";
import test from "node:test";
import { reconcilePendingCss } from "../packages/runtime/src/publication/css-reconciliation.ts";
import { installRepositoryTransport } from "../packages/shared/src/publication/client.ts";
import {
  setCssBookmark,
  getCssBookmark,
} from "../packages/runtime/src/ide/css-bookmarks.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";
function harness(ids, removeCSS) {
  const script = buildUserscriptFixture({ id: "css", enabled: false });
  let state = {
    cssOutbox: { css: "disable" },
    documents: { css: { script, revision: "off", parents: [] } },
    artifacts: {},
    settings: {},
    modules: {},
  };
  const local = { publicationBackend: "transactional" },
    session = {};
  const area = (store) => ({
    get: async () => store,
    set: async (values) => Object.assign(store, values),
    remove: async () => {},
  });
  const chrome = {
    storage: { local: area(local), session: area(session) },
    tabs: {
      query: async () => ids.map((id) => ({ id, url: "https://example.com/" })),
    },
    webNavigation: {
      getFrame: async ({ tabId }) => ({
        documentId: "doc-" + tabId,
        url: "https://example.com/",
      }),
    },
    scripting: { removeCSS },
    alarms: { create: async () => {}, clear: async () => {} },
  };
  installRepositoryTransport(async () => ({
    ...state,
    documents: Object.values(state.documents),
  }));
  const repository = {
    state: async () => structuredClone(state),
    update: async (transform) => {
      const next = transform(structuredClone(state));
      state = next.state;
      return next.value;
    },
  };
  return {
    chrome,
    repository,
    get state() {
      return state;
    },
  };
}
test("failed CSS cleanup retains its bookmark and obligation until a successful retry", async () => {
  const previous = globalThis.chrome;
  let attempts = 0;
  const h = harness([91], async () => {
    if (++attempts === 1) {
      throw new Error("temporary removal failure");
    }
  });
  globalThis.chrome = h.chrome;
  try {
    await setCssBookmark(91, "css", "html{opacity:.6}");
    await assert.rejects(
      () => reconcilePendingCss(h.repository),
      /temporary|reconcil/i
    );
    assert.equal(h.state.cssOutbox.css, "disable");
    assert.equal(await getCssBookmark(91, "css"), "html{opacity:.6}");
    await reconcilePendingCss(h.repository);
    assert.deepEqual(h.state.cssOutbox, {});
    assert.equal(await getCssBookmark(91, "css"), undefined);
  } finally {
    globalThis.chrome = previous;
  }
});
test("a failed tab does not prevent another tab's stylesheet cleanup", async () => {
  const previous = globalThis.chrome;
  const removed = [];
  const h = harness([92, 93], async ({ target }) => {
    if (target.tabId === 92) {
      throw new Error("restricted target");
    }
    removed.push(target.tabId);
  });
  globalThis.chrome = h.chrome;
  try {
    await setCssBookmark(92, "css", "old");
    await setCssBookmark(93, "css", "old");
    await assert.rejects(
      () => reconcilePendingCss(h.repository),
      /restricted|reconcil/i
    );
    assert.deepEqual(removed, [93]);
    assert.equal(h.state.cssOutbox.css, "disable");
  } finally {
    globalThis.chrome = previous;
  }
});

test("a rejected bookmark write cannot be mistaken for persisted cleanup on retry", async () => {
  const previous = globalThis.chrome;
  let removals = 0;
  const h = harness([94], async () => {
    removals++;
  });
  globalThis.chrome = h.chrome;
  try {
    await setCssBookmark(94, "css", "persisted");
    const original = h.chrome.storage.session.set;
    let fail = true;
    h.chrome.storage.session.set = async (values) => {
      if (fail) {
        fail = false;
        throw new Error("bookmark persistence rejected");
      }
      return original(values);
    };
    await assert.rejects(
      () => reconcilePendingCss(h.repository),
      /rejected|pending/i
    );
    assert.equal(h.state.cssOutbox.css, "disable");
    assert.equal(await getCssBookmark(94, "css"), "persisted");
    await reconcilePendingCss(h.repository);
    assert.equal(removals, 2);
    assert.equal(await getCssBookmark(94, "css"), undefined);
    assert.deepEqual(h.state.cssOutbox, {});
  } finally {
    globalThis.chrome = previous;
  }
});
