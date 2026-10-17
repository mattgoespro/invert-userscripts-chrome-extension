import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMutation,
  emptyRepositoryState,
} from "../packages/shared/src/storage/document-repository.ts";
import {
  flushSync,
  enableVerifiedReplication,
  ingestVerifiedSync,
} from "../packages/runtime/src/sync/sync-service.ts";
import {
  encodeSyncRevision,
  syncManifestKey,
} from "../packages/shared/src/storage/sync/revision-codec.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";
function harness(script) {
  let state = applyMutation(emptyRepositoryState(), {
    requestId: "initial",
    writes: [{ id: script.id, expectedRevision: null, script }],
  }).state;
  const sync = {},
    local = {};
  const area = (store) => ({
    get: async (keys) =>
      keys === null
        ? { ...store }
        : Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys]).map((key) => [
              key,
              store[key],
            ])
          ),
    set: async (values) => Object.assign(store, values),
    remove: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete store[key];
      }
    },
    QUOTA_BYTES: 102400,
  });
  const chrome = {
    storage: { local: area(local), sync: area(sync) },
    alarms: { create: async () => {}, clear: async () => {} },
  };
  const repository = {
    state: async () => structuredClone(state),
    snapshot: async () => ({
      ...state,
      documents: Object.values(state.documents),
    }),
    update: async (transform) => {
      const next = transform(structuredClone(state));
      state = next.state;
      return next.value;
    },
  };
  return {
    chrome,
    repository,
    sync,
    local,
    get state() {
      return state;
    },
  };
}
test("verified sync activation waits for an admitted legacy drain then emits v3 revisions", async () => {
  const previous = globalThis.chrome;
  const h = harness(buildUserscriptFixture({ id: "codec-switch" }));
  globalThis.chrome = h.chrome;
  let entered, release;
  const paused = new Promise((resolve) => {
    entered = resolve;
  });
  const original = h.chrome.storage.sync.set;
  h.chrome.storage.sync.set = async (values) => {
    if (Object.keys(values).some((key) => key.startsWith("userscript:"))) {
      entered();
      await new Promise((resolve) => {
        release = resolve;
      });
    }
    return original(values);
  };
  try {
    const legacy = flushSync(h.repository);
    await paused;
    const enabling = enableVerifiedReplication(h.repository);
    await new Promise((resolve) => setImmediate(resolve));
    assert.notEqual(h.local.verifiedSync, true);
    release();
    await legacy;
    await enabling;
    assert.equal(h.local.verifiedSync, true);
    assert.ok(
      Object.keys(h.sync).some(
        (key) => key.startsWith("revision:") && key.endsWith(":manifest")
      )
    );
    assert.deepEqual(h.state.outbox, {});
  } finally {
    release?.();
    globalThis.chrome = previous;
  }
});
test("remote alias collisions stay recoverable without entering the authoritative document set", async () => {
  const previous = globalThis.chrome;
  const h = harness(buildUserscriptFixture({ id: "a", moduleName: "same" }));
  globalThis.chrome = h.chrome;
  try {
    const remote = buildUserscriptFixture({ id: "b", moduleName: "same" });
    const encoded = await encodeSyncRevision(
      { revision: "remote-b", script: remote },
      []
    );
    Object.assign(h.sync, encoded.chunks, {
      [syncManifestKey("b", "remote-b")]: encoded.manifest,
    });
    await ingestVerifiedSync(h.repository);
    assert.deepEqual(Object.keys(h.state.documents), ["a"]);
    assert.match(h.state.syncConflicts.b[0].conflictReason, /alias/);
  } finally {
    globalThis.chrome = previous;
  }
});
test("quota failure retains the local document and outbox with pending sync feedback", async () => {
  const previous = globalThis.chrome;
  const h = harness(buildUserscriptFixture({ id: "quota" }));
  globalThis.chrome = h.chrome;
  h.local.verifiedSync = true;
  h.chrome.storage.sync.QUOTA_BYTES = 5;
  try {
    await assert.rejects(() => flushSync(h.repository), /quota/i);
    assert.ok(h.state.documents.quota);
    assert.equal(Object.keys(h.state.outbox).length, 1);
    assert.equal(h.local.publicationSyncStatus.status, "pending");
    assert.equal(Object.keys(h.sync).length, 0);
  } finally {
    globalThis.chrome = previous;
  }
});
