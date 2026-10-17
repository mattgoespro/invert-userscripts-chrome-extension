import { test, expect } from "../fixtures";
import { buildUserscriptSyncManifest } from "../fixtures/userscript-storage";
import type { Userscript } from "../../packages/shared/src/model";
import { buildCompiledLocalEntry } from "../helpers/injection";
const script = (id: string, moduleName = id): Userscript => ({
  id,
  moduleName,
  name: id,
  enabled: false,
  status: "saved",
  shared: false,
  sharedScripts: [],
  globalModules: [],
  typeDefinitions: "",
  code: {
    source: { typescript: "const value=1", scss: "" },
    compiled: { javascript: "", css: "" },
  },
  urlPatterns: ["https://example.com/*"],
  runAt: "afterPageLoad",
  createdAt: 1,
  updatedAt: 1,
});
test("activation retries cannot replace newer authoritative documents with retained legacy data", async ({
  optionsPage,
  clearStorage,
  seedStorage,
}) => {
  await clearStorage(optionsPage);
  const original = script("retry-migration");
  await seedStorage(optionsPage, { ["userscript:" + original.id]: original });
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.enableVerifiedSync" })
  );
  const before = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  const saved = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "new-authority",
      writes: [
        {
          id: original.id,
          expectedRevision: before.documents[0].revision,
          script: { ...original, name: "New local version" },
        },
      ],
    }
  );
  expect(saved.status).toBe("committed");
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  const after = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  expect(after.documents[0].revision).toBe(saved.documents[0].revision);
  expect(after.documents[0].script.name).toBe("New local version");
});

test("artifact receipts survive later settings changes and source deletion", async ({
  optionsPage,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  const original = script("artifact-retry");
  const artifact = buildCompiledLocalEntry(original, {
    javascript: "const value=1",
    css: "",
  })["compiled:" + original.id];
  const command = {
    requestId: "artifact-receipt",
    writes: [
      {
        id: original.id,
        expectedRevision: null as string | null,
        script: original,
        artifact,
      },
    ],
  };
  const first = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    command
  );
  expect(first.status).toBe("committed");
  const snapshot = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "later-settings",
      writes: [],
      settings: {
        expectedRevision: snapshot.settingsRevision,
        value: { minifyCompiledOutput: true },
      },
    }
  );
  expect(
    await optionsPage.evaluate(
      (command) =>
        chrome.runtime.sendMessage({ type: "publication.commit", command }),
      command
    )
  ).toEqual(first);
  await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "later-delete",
      writes: [
        {
          id: original.id,
          expectedRevision: first.documents[0].revision,
          deleted: true,
        },
      ],
    }
  );
  expect(
    await optionsPage.evaluate(
      (command) =>
        chrome.runtime.sendMessage({ type: "publication.commit", command }),
      command
    )
  ).toEqual(first);
  expect(
    (
      await optionsPage.evaluate(() =>
        chrome.runtime.sendMessage({ type: "publication.read" })
      )
    ).documents
  ).toHaveLength(0);
});
test("local transactions reject stale windows and preserve an atomic batch after alias collision", async ({
  optionsPage,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  const activated = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  expect(activated.error).toBeUndefined();
  const created = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "create-a",
      writes: [{ id: "a", expectedRevision: null, script: script("a") }],
    }
  );
  expect(created.status).toBe("committed");
  const revision = created.documents[0].revision;
  const duplicate = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "create-a",
      writes: [{ id: "a", expectedRevision: null, script: script("a") }],
    }
  );
  expect(duplicate.documents[0].revision).toBe(revision);
  const saved = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "save-a",
      writes: [
        {
          id: "a",
          expectedRevision: revision,
          script: { ...script("a"), name: "updated" },
        },
      ],
    }
  );
  expect(saved.status).toBe("committed");
  const stale = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "stale-a",
      writes: [{ id: "a", expectedRevision: revision, script: script("a") }],
    }
  );
  expect(stale.status).toBe("conflict");
  const collision = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "collision",
      writes: ["b", "c"].map((id) => ({
        id,
        expectedRevision: null as string | null,
        script: script(id, "same"),
      })),
    }
  );
  expect(collision.status).toBe("rejected");
  const snapshot = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  expect(
    snapshot.documents.map(
      (document: { script: Userscript }) => document.script.name
    )
  ).toEqual(["updated"]);
});
test("migration preserves source and leaves the legacy payload available for recovery", async ({
  optionsPage,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  const original = script("migration");
  await optionsPage.evaluate((payload) => chrome.storage.sync.set(payload), {
    "userscript:migration": buildUserscriptSyncManifest(original),
  });
  // Separate worker-scoped profiles per spec are not assumed; remove only this test's IDB state.
  await optionsPage.evaluate(async () => {
    const request = indexedDB.open("invert-ide-documents", 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("repository", "readwrite");
      tx.objectStore("repository").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  const result = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  expect(result.error).toBeUndefined();
  const snapshot = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  expect(
    snapshot.documents.find(
      (document: { script: Userscript }) => document.script.id === "migration"
    ).script.code.source.typescript
  ).toBe("const value=1");
  expect(
    await optionsPage.evaluate(() =>
      chrome.storage.sync.get("userscript:migration")
    )
  ).toHaveProperty("userscript:migration");
});
