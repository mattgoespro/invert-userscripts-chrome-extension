import assert from "node:assert/strict";
import test from "node:test";
import * as bootstrap from "../packages/runtime/src/drive/bootstrap.ts";
import { emptyRepositoryState } from "../packages/shared/src/storage/document-repository.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";
import { setDriveLayout } from "../packages/shared/src/storage/drive-sync.ts";

test("configured Drive startup repairs cleared durable state without restarting the worker", async () => {
  const previous = globalThis.chrome;
  let state = emptyRepositoryState();
  let local = {};
  let activations = 0;
  const listener = { addListener: () => {} };
  globalThis.chrome = {
    runtime: {
      getManifest: () => ({
        oauth2: { client_id: "123-configured.apps.googleusercontent.com" },
      }),
      onInstalled: listener,
      onStartup: listener,
    },
    storage: {
      local: {
        get: async () => structuredClone(local),
        set: async (values) => {
          Object.assign(local, values);
        },
      },
      sync: { get: async () => ({}) },
    },
    identity: {
      getAuthToken: async () => {
        throw new Error("A fresh profile needs consent");
      },
      onSignInChanged: listener,
    },
    alarms: { onAlarm: listener, create: async () => {} },
  };
  const repository = {
    state: async () => structuredClone(state),
    update: async (transform) => {
      const result = transform(structuredClone(state));
      state = result.state;
      return result.value;
    },
  };
  try {
    const service = bootstrap.initializeDriveSync(
      repository,
      async () => {
        activations++;
        local.publicationBackend = "transactional";
      },
      () => {}
    );
    await service.run();
    assert.ok(
      state.drive,
      "configured startup prepares before requesting consent"
    );
    assert.equal(activations, 1);

    state.drive.accountId = "original-account";
    setDriveLayout(state, { activeSidebarTab: "settings" });
    const before = structuredClone(state.drive);
    await service.run();
    assert.deepEqual(
      state.drive,
      before,
      "a healthy retry preserves account binding and pending revisions"
    );
    assert.equal(activations, 1, "healthy storage does not need reactivation");

    state = emptyRepositoryState();
    local = {};
    await service.run();
    assert.ok(
      state.drive,
      "a completed initialization promise cannot stand in for cleared durable storage"
    );
    assert.equal(local.driveSyncEnabled, true);
    assert.equal(local.publicationBackend, "transactional");
    assert.equal(activations, 2);

    state.drive.accountId = "original-account";
    setDriveLayout(state, { activeSidebarTab: "modules" });
    const retained = structuredClone(state.drive);
    local = {};
    await service.run();
    assert.equal(
      local.driveSyncEnabled,
      true,
      "lost transport flags are repaired too"
    );
    assert.equal(local.publicationBackend, "transactional");
    assert.deepEqual(
      state.drive,
      retained,
      "repairing flags must not discard the existing account or outbox"
    );
  } finally {
    globalThis.chrome = previous;
  }
});
test("existing transactional window layout takes precedence over stale native sync layout", () => {
  const value = bootstrap.chooseDriveLayout(
    {
      "globalState:window-1": {
        activeSidebarTab: "settings",
        panelSizes: { scriptListSidebarWidth: 43 },
      },
    },
    { activeSidebarTab: "scripts" }
  );
  assert.equal(value.activeSidebarTab, "settings");
  assert.equal(value.panelSizes.scriptListSidebarWidth, 43);
});
test("restored scripts without artifacts start the existing IDE compiler host", async () => {
  const previous = globalThis.chrome;
  let opened = 0;
  const state = emptyRepositoryState();
  state.documents.a = {
    script: buildUserscriptFixture({ id: "a" }),
    revision: "restored",
    parents: [],
  };
  globalThis.chrome = {
    runtime: {
      getURL: (path) => "chrome-extension://fixture/" + path,
      openOptionsPage: async () => {
        opened++;
      },
    },
    tabs: { query: async () => [] },
  };
  try {
    await bootstrap.ensureRestoreCompiler({ state: async () => state });
    assert.equal(opened, 1);
  } finally {
    globalThis.chrome = previous;
  }
});
