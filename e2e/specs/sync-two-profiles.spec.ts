import { chromium, type Page } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, expect, buildUserscript } from "../fixtures";
const request = (page: Page, message: unknown) =>
  page.evaluate((message) => chrome.runtime.sendMessage(message), message);
const revisions = (page: Page) =>
  page.evaluate(async () =>
    Object.fromEntries(
      Object.entries(await chrome.storage.sync.get(null)).filter(([key]) =>
        key.startsWith("revision:")
      )
    )
  );

test("two independent profiles retain concurrent edits and converge after explicit resolution (transport simulation)", async ({
  optionsPage,
  clearStorage,
}) => {
  await clearStorage(optionsPage);
  await request(optionsPage, { type: "publication.activate" });
  await request(optionsPage, { type: "publication.enableVerifiedSync" });
  const profile = await mkdtemp(path.join(tmpdir(), "invert-sync-rehearsal-"));
  const dist = path.resolve(import.meta.dirname, "../../dist");
  const peer = await chromium.launchPersistentContext(profile, {
    headless: false,
    bypassCSP: false,
    args: [
      "--headless=new",
      "--no-first-run",
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
    ],
  });
  try {
    const worker =
      peer.serviceWorkers()[0] ?? (await peer.waitForEvent("serviceworker"));
    const page = await peer.newPage();
    await page.goto(
      `chrome-extension://${new URL(worker.url()).host}/options.html`
    );
    await page.waitForSelector('[title="Scripts"]');
    await request(page, { type: "publication.activate" });
    await request(page, { type: "publication.enableVerifiedSync" });
    const script = buildUserscript({
      id: "replicated",
      name: "Base",
      moduleName: "replicated",
      shared: false,
      enabled: false,
    });
    const initial = await request(optionsPage, {
      type: "publication.commit",
      command: {
        requestId: "base",
        writes: [{ id: script.id, expectedRevision: null, script }],
      },
    });
    expect(initial.status).toBe("committed");
    await request(optionsPage, { type: "publication.retrySync" });
    await page.evaluate(
      (data) => chrome.storage.sync.set(data),
      await revisions(optionsPage)
    );
    await request(page, { type: "publication.retrySync" });
    const base = initial.documents[0].revision;
    const local = await request(optionsPage, {
      type: "publication.commit",
      command: {
        requestId: "device-a",
        writes: [
          {
            id: script.id,
            expectedRevision: base,
            script: { ...script, name: "Device A" },
          },
        ],
      },
    });
    const remote = await request(page, {
      type: "publication.commit",
      command: {
        requestId: "device-b",
        writes: [
          {
            id: script.id,
            expectedRevision: base,
            script: { ...script, name: "Device B" },
          },
        ],
      },
    });
    expect(local.status).toBe("committed");
    expect(remote.status).toBe("committed");
    await request(optionsPage, { type: "publication.retrySync" });
    await request(page, { type: "publication.retrySync" });
    const fromA = await revisions(optionsPage);
    const fromB = await revisions(page);
    await page.evaluate((data) => chrome.storage.sync.set(data), fromA);
    await optionsPage.evaluate((data) => chrome.storage.sync.set(data), fromB);
    await request(optionsPage, { type: "publication.retrySync" });
    await request(page, { type: "publication.retrySync" });
    const status = await request(optionsPage, { type: "publication.status" });
    const peerStatus = await request(page, { type: "publication.status" });
    expect(
      status.conflicts.replicated.some(
        (entry: { revision: string }) =>
          entry.revision === remote.documents[0].revision
      )
    ).toBe(true);
    expect(
      peerStatus.conflicts.replicated.some(
        (entry: { revision: string }) =>
          entry.revision === local.documents[0].revision
      )
    ).toBe(true);
    expect(
      (
        await request(optionsPage, {
          type: "publication.resolve",
          id: script.id,
          revision: local.documents[0].revision,
          generation: status.generation,
        })
      ).status
    ).toBe("resolved");
    await request(optionsPage, { type: "publication.retrySync" });
    await page.evaluate(
      (data) => chrome.storage.sync.set(data),
      await revisions(optionsPage)
    );
    await request(page, { type: "publication.retrySync" });
    expect(
      (await request(page, { type: "publication.read" })).documents[0].script
        .name
    ).toBe("Device A");
    expect(
      (await request(page, { type: "publication.status" })).conflicts.replicated
    ).toBeUndefined();
  } finally {
    await peer.close();
  }
});
