import assert from "node:assert/strict";
import test from "node:test";
import {
  documentRepository,
  handleRepositoryRequest,
} from "../packages/runtime/src/publication/coordinator.ts";
import { reconcilePendingCss } from "../packages/runtime/src/publication/css-reconciliation.ts";
import { runPublicationEffect } from "../packages/runtime/src/publication/effects.ts";
import { flushSync } from "../packages/runtime/src/sync/sync-service.ts";
import {
  ChromeSyncStorage,
  CompiledCodeStorage,
} from "../packages/shared/src/storage/index.ts";
import { emptyRepositoryState } from "../packages/shared/src/storage/document-repository.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

const area = (store) => ({
  get: async (keys) =>
    keys === null || keys === undefined
      ? { ...store }
      : Object.fromEntries(
          (Array.isArray(keys) ? keys : [keys]).map((key) => [key, store[key]])
        ),
  set: async (values) => {
    Object.assign(store, values);
  },
  remove: async (keys) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      delete store[key];
    }
  },
});

function harness(local = {}) {
  let state = emptyRepositoryState();
  const sync = {};
  const repository = {
    state: async () => structuredClone(state),
    update: async (transform) => {
      const next = transform(structuredClone(state));
      state = next.state;
      return next.value;
    },
  };
  const chrome = {
    runtime: { id: "test", sendMessage: async () => {} },
    storage: { local: area(local), sync: area(sync), session: area({}) },
    tabs: { query: async () => [] },
    alarms: { create: async () => {}, clear: async () => {} },
  };
  return {
    chrome,
    repository,
    sync,
    get state() {
      return state;
    },
    set state(value) {
      state = value;
    },
  };
}

async function withChrome(chrome, run) {
  const previous = globalThis.chrome;
  globalThis.chrome = chrome;
  try {
    await run();
  } finally {
    globalThis.chrome = previous;
  }
}

function withDocumentRepository(repository) {
  const originals = {
    state: documentRepository.state,
    update: documentRepository.update,
  };
  documentRepository.state = repository.state;
  documentRepository.update = repository.update;
  return () => Object.assign(documentRepository, originals);
}

const settled = () => new Promise((resolve) => setImmediate(resolve));

test("a hung effect does not delay an effect for another tab", async () => {
  const hung = runPublicationEffect("hung", () => new Promise(() => {}));
  const other = await runPublicationEffect("other", async () => ({
    success: true,
    appliedTabCount: 1,
  }));
  assert.equal(other.appliedTabCount, 1);
  assert.equal(
    await Promise.race([
      hung.then(() => "settled"),
      settled().then(() => "open"),
    ]),
    "open"
  );
});

test("a retry of a running effect joins it instead of reporting an unknown outcome", async () => {
  const h = harness({ publicationBackend: "transactional" });
  const restore = withDocumentRepository(h.repository);
  await withChrome(h.chrome, async () => {
    try {
      let executions = 0;
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const execute = async () => {
        executions++;
        await gate;
        return { success: true, appliedTabCount: 1 };
      };
      const first = runPublicationEffect("retried", execute);
      await settled();
      const retry = runPublicationEffect("retried", execute);
      release();
      assert.deepEqual(await first, { success: true, appliedTabCount: 1 });
      assert.deepEqual(await retry, { success: true, appliedTabCount: 1 });
      assert.equal(executions, 1);
      assert.deepEqual(
        await runPublicationEffect("retried", execute),
        { success: true, appliedTabCount: 1 },
        "a later retry replays the durable receipt"
      );
      assert.equal(executions, 1);
    } finally {
      restore();
    }
  });
});

test("per-page-load navigation records are purged from the aggregate and command records stay", async () => {
  const h = harness({ publicationBackend: "transactional" });
  h.state = {
    ...h.state,
    effects: {
      "navigation:doc-1:beforePageLoad": { status: "started" },
      "navigation:doc-2:afterPageLoad": { status: "completed", result: {} },
      "earlier-command": {
        status: "completed",
        result: { success: true, appliedTabCount: 0 },
      },
    },
  };
  const restore = withDocumentRepository(h.repository);
  await withChrome(h.chrome, async () => {
    try {
      await runPublicationEffect("command", async () => ({
        success: true,
        appliedTabCount: 0,
      }));
      assert.deepEqual(Object.keys(h.state.effects).sort(), [
        "command",
        "earlier-command",
      ]);
    } finally {
      restore();
    }
  });
});

test("discarding a conflict stores a tombstone revision with no script key", async () => {
  const h = harness({
    publicationBackend: "transactional",
    driveSyncEnabled: true,
  });
  const script = buildUserscriptFixture({ id: "discarded" });
  h.state = {
    ...h.state,
    generation: 4,
    documents: { discarded: { script, revision: "local", parents: [] } },
    syncHeads: { discarded: ["local", "remote"] },
    syncConflicts: {
      discarded: [{ id: "discarded", revision: "remote", parents: [], script }],
    },
  };
  const restore = withDocumentRepository(h.repository);
  await withChrome(h.chrome, async () => {
    try {
      await handleRepositoryRequest({
        type: "publication.resolve",
        id: "discarded",
        revision: "remote",
        generation: 4,
        discard: true,
      });
      await settled();
      const [entry] = Object.values(h.state.outbox);
      assert.ok(entry);
      assert.equal("script" in entry, false);
      assert.equal(h.state.documents.discarded, undefined);
      assert.ok(h.state.tombstones.discarded);
    } finally {
      restore();
    }
  });
});

test("a stylesheet obligation committed during the drain's tail is still processed", async () => {
  const h = harness();
  h.state = { ...h.state, cssOutbox: { first: "token-1" } };
  const reads = [
    ChromeSyncStorage.getAllScripts,
    ChromeSyncStorage.getEditorSettings,
    CompiledCodeStorage.getCompiledCode,
  ];
  ChromeSyncStorage.getAllScripts = async () => ({});
  ChromeSyncStorage.getEditorSettings = async () => ({});
  CompiledCodeStorage.getCompiledCode = async () => null;
  let joined;
  h.chrome.alarms.clear = async () => {
    if (!joined) {
      await h.repository.update((state) => {
        state.cssOutbox.late = "token-2";
        return { state, value: undefined };
      });
      joined = reconcilePendingCss(h.repository);
    }
  };
  await withChrome(h.chrome, async () => {
    try {
      await reconcilePendingCss(h.repository);
      await joined;
      assert.deepEqual(h.state.cssOutbox, {});
    } finally {
      [
        ChromeSyncStorage.getAllScripts,
        ChromeSyncStorage.getEditorSettings,
        CompiledCodeStorage.getCompiledCode,
      ] = reads;
    }
  });
});

test("replication committed during the drain's tail is still flushed", async () => {
  const h = harness();
  h.state = { ...h.state, settings: { fontSize: 14 } };
  let joined;
  h.chrome.alarms.clear = async () => {
    if (!joined) {
      await h.repository.update((state) => {
        state.preferenceOutbox.settings = "token";
        return { state, value: undefined };
      });
      joined = flushSync(h.repository);
    }
  };
  await withChrome(h.chrome, async () => {
    await flushSync(h.repository);
    await joined;
    assert.deepEqual(h.state.preferenceOutbox, {});
    assert.deepEqual(h.sync.editorSettings, { fontSize: 14 });
  });
});
