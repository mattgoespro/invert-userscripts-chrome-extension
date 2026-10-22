import assert from "node:assert/strict";
import test from "node:test";
import { DriveSyncService } from "../packages/runtime/src/drive/service.ts";
import {
  emptyRepositoryState,
  applyMutation,
} from "../packages/shared/src/storage/document-repository.ts";
import {
  enableDriveState,
  setDriveLayout,
} from "../packages/shared/src/storage/drive-sync.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

test("disconnect pauses automatic sync across restart and reconnect uploads retained changes", async () => {
  const h = harness();
  const service = h.makeService();
  await service.run(true);
  h.save("Pending before disconnect");
  const pending = structuredClone(h.state.drive.pending);
  await service.disconnect();
  assert.equal(h.storedStatus.phase, "disconnected");
  assert.equal((await service.status()).connected, false);
  assert.equal(h.state.drive.accountId, "account-a");
  assert.deepEqual(h.state.drive.pending, pending);
  h.events.length = 0;
  h.save("Edited while disconnected");
  const restarted = h.makeService();
  await restarted.run();
  await restarted.run(false, true);
  assert.equal((await restarted.status()).phase, "disconnected");
  assert.deepEqual(
    h.events,
    [],
    "retry and manual download must not authorize while paused"
  );
  await restarted.run(true);
  assert.equal((await restarted.status()).connected, true);
  assert.equal(h.storedStatus.phase, "synced");
  assert.equal(h.state.drive.pending.length, 0);
  h.clearLocal();
  await h.makeService().run();
  assert.equal(h.state.documents.a.script.name, "Edited while disconnected");
});

test("an expired authorization offers Connect while retaining account isolation", async () => {
  const h = harness();
  const service = h.makeService();
  await service.run(true);
  service.invalidate();
  // invalidate reports asynchronously, just as a sign-out notification does.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await service.status()).connected, false);
  assert.equal(h.state.drive.accountId, "account-a");
  h.save("Changes after sign out");
  service.schedule();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    (await service.status()).connected,
    false,
    "pending local edits cannot restore authorization"
  );
  await service.disconnect();
});

test("disconnect cancels an in-flight download before it can upload pending edits", async () => {
  const h = harness();
  const service = h.makeService();
  await service.run(true);
  h.save("Pending during download");
  let release;
  let reached;
  const downloading = new Promise((resolve) => {
    reached = resolve;
  });
  const download = new Promise((resolve) => {
    release = resolve;
  });
  h.transport.list = async () => {
    reached();
    await download;
    return [];
  };
  const syncing = service.run();
  await downloading;
  const disconnecting = service.disconnect();
  release();
  await Promise.all([syncing, disconnecting]);
  assert.equal(h.state.drive.pending.length, 1);
  assert.equal(h.files.size, 0);
  assert.equal((await service.status()).phase, "disconnected");
});

test("downloaded account ownership survives deferred local adoption and rejects another account", async () => {
  const h = harness();
  h.layout({ activeSidebarTab: "settings" });
  h.files.set("remote", [
    {
      kind: "script",
      id: "a",
      revision: "private-a",
      parents: [],
      script: buildUserscriptFixture({
        id: "a",
        moduleName: "a",
        name: "Private account A",
      }),
    },
  ]);
  await h.makeService().run();
  h.save("Private A edited");
  await h.makeService().run();
  assert.equal(
    h.files.size,
    1,
    "a restart must not silently adopt pending data"
  );
  h.setAccount("account-b");
  h.events.length = 0;
  await h.makeService().run(true);
  assert.equal(h.storedStatus.phase, "account-mismatch");
  assert.deepEqual(h.events, []);
  assert.equal(h.state.drive.pending.length, 2);
});

test("an unbound local layout cannot block automatic cloud restoration", async () => {
  const h = harness();
  h.layout({ activeSidebarTab: "settings" });
  h.files.set("remote", [
    {
      kind: "script",
      id: "a",
      revision: "cloud-script",
      parents: [],
      script: buildUserscriptFixture({
        id: "a",
        moduleName: "a",
        name: "Restored automatically",
      }),
    },
  ]);
  await h.makeService().run();
  assert.equal(h.state.documents.a?.script.name, "Restored automatically");
  assert.equal(h.files.size, 1);
  assert.equal(h.state.drive.accountId, "account-a");
});

function harness() {
  let state = emptyRepositoryState();
  enableDriveState(state);
  const files = new Map(),
    events = [];
  let storedStatus,
    account = "account-a",
    offline = false,
    nextId = 1;
  const repository = {
    state: async () => structuredClone(state),
    update: async (transform) => {
      const result = transform(structuredClone(state));
      state = result.state;
      return result.value;
    },
  };
  const transport = {
    list: async () => {
      events.push("download");
      if (offline) throw new TypeError("offline");
      return [...files.keys()];
    },
    download: async (id) => structuredClone(files.get(id)),
    generateId: async () => "file-" + nextId++,
    upload: async (id, records) => {
      if (offline) throw new TypeError("offline");
      files.set(id, structuredClone(records));
      events.push("upload");
    },
  };
  const options = {
    repository,
    configured: () => true,
    prepare: async () => {},
    authorize: async () => ({
      accountId: account,
      accountLabel: account,
      transport,
    }),
    writeStatus: async (value) => {
      storedStatus = value;
    },
    readStatus: async () => storedStatus,
    clearAuthorization: async () => {},
    retry: async () => {},
    notify: () => {},
  };
  const makeService = () => new DriveSyncService(options);
  return {
    repository,
    transport,
    files,
    events,
    makeService,
    get state() {
      return state;
    },
    get storedStatus() {
      return storedStatus;
    },
    setAccount: (value) => {
      account = value;
    },
    setOffline: (value) => {
      offline = value;
    },
    save: (name) => {
      state = applyMutation(state, {
        requestId: crypto.randomUUID(),
        writes: [
          {
            id: "a",
            expectedRevision: state.documents.a?.revision ?? null,
            script: buildUserscriptFixture({ id: "a", moduleName: "a", name }),
          },
        ],
      }).state;
    },
    layout: (value) => setDriveLayout(state, value),
    clearLocal: () => {
      state = emptyRepositoryState();
      enableDriveState(state);
    },
  };
}
test("reinstallation restores scripts settings and layout before uploading anything", async () => {
  const h = harness();
  h.save("Before reinstall");
  h.layout({
    activeSidebarTab: "modules",
    panelSizes: { scriptListSidebarWidth: 33 },
  });
  await h.repository.update((state) => {
    const next = applyMutation(state, {
      requestId: "settings",
      writes: [],
      settings: { expectedRevision: null, value: { fontSize: 21 } },
    });
    return { state: next.state, value: undefined };
  });
  await h.makeService().run(true);
  assert.equal(h.storedStatus.phase, "synced");
  h.clearLocal();
  h.events.length = 0;
  await h.makeService().run();
  assert.equal(h.state.documents.a.script.name, "Before reinstall");
  assert.equal(h.state.settings.fontSize, 21);
  assert.equal(h.state.drive.layout.panelSizes.scriptListSidebarWidth, 33);
  assert.deepEqual(h.events, ["download"]);
  assert.equal(h.storedStatus.phase, "synced");
});
test("offline edits stay durable across service restart and upload automatically after reconnect", async () => {
  const h = harness();
  await h.makeService().run(true);
  h.setOffline(true);
  h.save("Offline edit");
  await h.makeService().run();
  assert.equal(h.storedStatus.phase, "offline");
  assert.equal(h.state.drive.pending.length, 1);
  h.setOffline(false);
  await h.makeService().run();
  assert.equal(h.state.drive.pending.length, 0);
  assert.equal(h.storedStatus.phase, "synced");
  assert.equal([...h.files.values()].flat()[0].script.name, "Offline edit");
});
test("a different account cannot read or receive the previous account's pending work", async () => {
  const h = harness();
  await h.makeService().run(true);
  h.save("Private A");
  h.setAccount("account-b");
  h.events.length = 0;
  await h.makeService().run(true);
  assert.equal(h.storedStatus.phase, "account-mismatch");
  assert.equal(h.files.size, 0);
  assert.equal(h.state.drive.pending.length, 1);
  assert.deepEqual(h.events, []);
});
test("an ambiguous upload retries the persisted file ID and preserves mutations made in flight", async () => {
  const h = harness();
  await h.makeService().run(true);
  h.save("First");
  const original = h.transport.upload;
  let first = true;
  h.transport.upload = async (id, records) => {
    await original(id, records);
    if (first) {
      first = false;
      h.save("Second");
      throw new TypeError("connection lost after commit");
    }
  };
  await h.makeService().run();
  const interruptedId = h.state.drive.upload.fileId;
  assert.equal(h.state.drive.pending.length, 2);
  await h.makeService().run();
  assert.ok(h.files.has(interruptedId));
  assert.equal(h.files.size, 2);
  assert.equal(h.state.drive.pending.length, 0);
  assert.equal(h.state.documents.a.script.name, "Second");
});
test("initial local data needs an explicit account connection but an empty reinstall restores silently", async () => {
  const h = harness();
  h.save("Existing local");
  await h.makeService().run();
  assert.equal(h.storedStatus.phase, "connect-required");
  assert.equal(h.files.size, 0);
  await h.makeService().run(true);
  assert.equal(h.files.size, 1);
});
test("a corrupt cloud download prevents uploads without dropping local work", async () => {
  const h = harness();
  await h.makeService().run(true);
  h.save("Recoverable");
  h.files.set("bad", [
    { kind: "script", revision: "bad", parents: [], id: "x", script: {} },
  ]);
  await h.makeService().run();
  assert.equal(h.storedStatus.phase, "error");
  assert.equal(h.state.drive.pending.length, 1);
  assert.equal(h.files.size, 1);
});
