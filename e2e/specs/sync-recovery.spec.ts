import { buildCompiledLocalEntry } from "../helpers/injection";
import { test, expect, buildUserscript } from "../fixtures";
import { encodeSyncRevision } from "../../packages/shared/src/storage/sync/revision-codec";
test("an incoming alias collision remains a conflict and cannot be promoted through resolution", async ({
  optionsPage,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.enableVerifiedSync" })
  );
  const local = buildUserscript({
    id: "alias-a",
    name: "Local alias",
    moduleName: "same",
    shared: true,
    enabled: false,
  });
  await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "local-alias",
      writes: [
        {
          id: local.id,
          expectedRevision: null as string | null,
          script: local,
          artifact: buildCompiledLocalEntry(local, { javascript: "", css: "" })[
            "compiled:" + local.id
          ],
        },
      ],
    }
  );
  const remote = await encodeSyncRevision(
    {
      revision: "alias-remote",
      parents: [],
      script: { ...local, id: "alias-b", name: "Remote alias" },
    },
    []
  );
  await optionsPage.evaluate((data) => chrome.storage.sync.set(data), {
    ...remote.chunks,
    "revision:alias-b:alias-remote:manifest": remote.manifest,
  });
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.retrySync" })
  );
  const status = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.status" })
  );
  expect(status.conflicts["alias-b"][0].conflictReason).toContain("alias");
  const rejected = await optionsPage.evaluate(
    (generation) =>
      chrome.runtime.sendMessage({
        type: "publication.resolve",
        id: "alias-b",
        revision: "alias-remote",
        generation,
      }),
    status.generation
  );
  expect(rejected.error).toContain("alias");
  const snapshot = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  expect(
    snapshot.documents.map(
      (document: { script: { id: string } }) => document.script.id
    )
  ).toEqual(["alias-a"]);
  const current = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.status" })
  );
  expect(
    (
      await optionsPage.evaluate(
        (generation) =>
          chrome.runtime.sendMessage({
            type: "publication.resolve",
            id: "alias-b",
            revision: "alias-remote",
            generation,
            discard: true,
          }),
        current.generation
      )
    ).status
  ).toBe("resolved");
});
test("late parent delivery converges to the descendant and removes an apparent conflict", async ({
  optionsPage,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.enableVerifiedSync" })
  );
  const source = buildUserscript({
    id: "late-parent",
    moduleName: "late-parent",
    enabled: false,
  });
  for (const [revision, parents, name] of [
    ["a", [], "A"],
    ["c", ["b"], "C"],
    ["b", ["a"], "B"],
  ] as const) {
    const encoded = await encodeSyncRevision(
      { revision, parents: [...parents], script: { ...source, name } },
      [...parents]
    );
    await optionsPage.evaluate((data) => chrome.storage.sync.set(data), {
      ...encoded.chunks,
      ["revision:late-parent:" + revision + ":manifest"]: encoded.manifest,
    });
    await optionsPage.evaluate(() =>
      chrome.runtime.sendMessage({ type: "publication.retrySync" })
    );
  }
  const snapshot = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  expect(snapshot.documents[0].script.name).toBe("C");
  const status = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.status" })
  );
  expect(status.conflicts["late-parent"]).toBeUndefined();
});
test("verified sync waits for complete chunks and preserves concurrent branches as conflicts", async ({
  optionsPage,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.activate" })
  );
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.enableVerifiedSync" })
  );
  const source = buildUserscript({
    id: "remote-script",
    name: "Remote initial",
    enabled: false,
    moduleName: "remote",
  });
  const encoded = await encodeSyncRevision(
    { revision: "remote-1", parents: [], script: source },
    []
  );
  await optionsPage.evaluate(
    (manifest) =>
      chrome.storage.sync.set({
        "revision:remote-script:remote-1:manifest": manifest,
      }),
    encoded.manifest
  );
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.retrySync" })
  );
  let snapshot = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  expect(
    snapshot.documents.find(
      (item: { script: { id: string } }) => item.script.id === "remote-script"
    )
  ).toBeUndefined();
  await optionsPage.evaluate(
    (chunks) => chrome.storage.sync.set(chunks),
    encoded.chunks
  );
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.retrySync" })
  );
  snapshot = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  expect(snapshot.documents[0].script.name).toBe("Remote initial");
  const local = await optionsPage.evaluate(
    (command) =>
      chrome.runtime.sendMessage({ type: "publication.commit", command }),
    {
      requestId: "local-edit",
      writes: [
        {
          id: source.id,
          expectedRevision: "remote-1",
          script: { ...source, name: "Local edit" },
        },
      ],
    }
  );
  expect(local.status).toBe("committed");
  const remote = await encodeSyncRevision(
    {
      revision: "remote-2",
      parents: ["remote-1"],
      script: { ...source, name: "Concurrent edit" },
    },
    ["remote-1"]
  );
  await optionsPage.evaluate((data) => chrome.storage.sync.set(data), {
    ...remote.chunks,
    "revision:remote-script:remote-2:manifest": remote.manifest,
  });
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.retrySync" })
  );
  const status = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.status" })
  );
  expect(
    status.conflicts["remote-script"].map(
      (item: { revision: string }) => item.revision
    )
  ).toContain("remote-2");
  snapshot = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: "publication.read" })
  );
  expect(snapshot.documents[0].script.name).toBe("Local edit");
});
