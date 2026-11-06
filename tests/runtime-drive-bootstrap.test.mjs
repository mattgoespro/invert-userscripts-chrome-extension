import assert from "node:assert/strict";
import test from "node:test";
import { initializeDriveSync } from "../packages/runtime/src/drive/bootstrap.ts";
import { handleDriveRequest } from "../packages/runtime/src/drive/runtime.ts";
import { emptyRepositoryState } from "../packages/shared/src/storage/document-repository.ts";

const LAYOUT_WRITE = {
  type: "publication.drive.layout.write",
  value: { activeSidebarTab: "settings" },
};

/** Boots Drive with an unconfigured client so only explicit prepare() calls run. */
async function withBootstrap({ local = {}, state, activate }, body) {
  const previous = globalThis.chrome;
  const previousError = console.error;
  const listener = { addListener: () => {} };
  const h = {
    local,
    state: state ?? emptyRepositoryState(),
    flagDuringActivation: undefined,
    failUpdate: false,
  };
  globalThis.chrome = {
    runtime: {
      getManifest: () => ({}),
      onInstalled: listener,
      onStartup: listener,
    },
    storage: {
      local: {
        get: async () => structuredClone(h.local),
        set: async (values) => {
          Object.assign(h.local, values);
        },
        remove: async (key) => {
          delete h.local[key];
        },
      },
      sync: { get: async () => ({}) },
    },
    identity: { onSignInChanged: listener },
    alarms: { onAlarm: listener, create: async () => {} },
  };
  console.error = () => {};
  const repository = {
    state: async () => structuredClone(h.state),
    update: async (transform) => {
      if (h.failUpdate) {
        throw new Error("update rejected");
      }
      const result = transform(structuredClone(h.state));
      h.state = result.state;
      return result.value;
    },
  };
  try {
    initializeDriveSync(
      repository,
      async () => {
        h.flagDuringActivation = h.local.driveSyncEnabled;
        await activate(h);
      },
      () => {}
    );
    await new Promise((resolve) => setImmediate(resolve));
    await body(h);
  } finally {
    globalThis.chrome = previous;
    console.error = previousError;
  }
}

const duplicateAliases = async () => {
  throw new Error("duplicate legacy aliases");
};

test("failed activation rolls back the Drive flag and surfaces the original error", async () => {
  await withBootstrap({ activate: duplicateAliases }, async (h) => {
    await assert.rejects(
      () => handleDriveRequest(LAYOUT_WRITE),
      /duplicate legacy aliases/
    );
    assert.equal(
      h.flagDuringActivation,
      true,
      "native transport stays off while activation runs"
    );
    assert.equal(h.local.driveSyncEnabled, undefined);
    assert.equal(h.state.drive, undefined);
  });
});

test("a flag stranded by an earlier failed attempt is rolled back too", async () => {
  await withBootstrap(
    { local: { driveSyncEnabled: true }, activate: duplicateAliases },
    async (h) => {
      await assert.rejects(
        () => handleDriveRequest(LAYOUT_WRITE),
        /duplicate legacy aliases/
      );
      assert.equal(h.local.driveSyncEnabled, undefined);
    }
  );
});

test("a failure after activation rolls back the flag", async () => {
  await withBootstrap(
    {
      activate: async (h) => {
        h.local.publicationBackend = "transactional";
        h.failUpdate = true;
      },
    },
    async (h) => {
      await assert.rejects(
        () => handleDriveRequest(LAYOUT_WRITE),
        /update rejected/
      );
      assert.equal(h.local.driveSyncEnabled, undefined);
    }
  );
});

test("an established Drive account keeps native transport off when repair fails", async () => {
  const state = emptyRepositoryState();
  state.drive = { accountId: "original-account" };
  await withBootstrap(
    { local: { driveSyncEnabled: true }, state, activate: duplicateAliases },
    async (h) => {
      await assert.rejects(
        () => handleDriveRequest(LAYOUT_WRITE),
        /duplicate legacy aliases/
      );
      assert.equal(h.local.driveSyncEnabled, true);
    }
  );
});

test("a retry after the blocker is fixed enables Drive", async (t) => {
  // The saved layout schedules a Drive run that must not outlive the mocks.
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let blocked = true;
  await withBootstrap(
    {
      activate: async (h) => {
        if (blocked) {
          throw new Error("duplicate legacy aliases");
        }
        h.local.publicationBackend = "transactional";
      },
    },
    async (h) => {
      await assert.rejects(() => handleDriveRequest(LAYOUT_WRITE));
      blocked = false;
      assert.deepEqual(await handleDriveRequest(LAYOUT_WRITE), {
        status: "saved",
      });
      assert.equal(h.local.driveSyncEnabled, true);
      assert.ok(h.state.drive);
    }
  );
});
