import { test, expect, buildUserscript } from "../fixtures";
import type { Page, Worker } from "@playwright/test";
import { chromium } from "@playwright/test";
import path from "node:path";
import driveConfiguration from "../../config/google-drive.json" with { type: "json" };
import { OptionsPage, ScriptsPage } from "../page-objects";
import {
  replaceMonacoEditorContent,
  saveMonacoEditor,
  typescriptEditor,
  readTypescriptEditorText,
} from "../helpers/monaco";

async function expectSyncedAndOpenSettings(page: Page): Promise<void> {
  // Restoring saved layout can navigate away from Settings; the removed global
  // banner used to survive that navigation. Read background status first.
  await expect
    .poll(
      () =>
        page.evaluate(
          async () =>
            (
              await chrome.runtime.sendMessage({
                type: "publication.drive.status",
              })
            ).phase
        ),
      { timeout: 15_000 }
    )
    .toBe("synced");
  await new OptionsPage(page).clickTab("settings");
  const advanced = page.getByRole("button", { name: "Advanced", exact: true });
  if ((await advanced.getAttribute("aria-expanded")) === "false") {
    await advanced.click();
  }
  await expect(page.getByTestId("drive-sync-panel")).toContainText(
    "Synced to Google Drive"
  );
}

// Replace only external identity/HTTP boundaries. The built coordinator, IndexedDB,
// gzip codec, mutation queue and renderer run unchanged in Chromium.
async function driveGateway(worker: Worker): Promise<void> {
  await worker.evaluate(() => {
    const originalManifestGetter = chrome.runtime.getManifest;
    const originalAuth = chrome.identity.getAuthToken;
    const originalManifest = chrome.runtime.getManifest();
    if (!originalManifest.oauth2?.client_id) {
      chrome.runtime.getManifest = () => ({
        ...originalManifest,
        oauth2: {
          client_id: "123-fixture.apps.googleusercontent.com",
          scopes: ["https://www.googleapis.com/auth/drive.appdata"],
        },
      });
    }
    chrome.identity.getAuthToken = async () => ({
      token: "controlled-drive-token",
    });
    const fixture = {
      files: {} as Record<string, number[]>,
      offline: false,
      nextId: 1,
    };
    Object.assign(globalThis, { driveFixture: fixture });
    const realFetch = globalThis.fetch;
    Object.assign(globalThis, {
      driveFixtureRestore: () => {
        chrome.runtime.getManifest = originalManifestGetter;
        chrome.identity.getAuthToken = originalAuth;
        globalThis.fetch = realFetch;
        Reflect.deleteProperty(globalThis, "driveFixture");
        Reflect.deleteProperty(globalThis, "driveFixtureRestore");
      },
    });
    globalThis.fetch = async function (this: typeof globalThis, input, init) {
      if (this !== globalThis) {
        throw new TypeError(
          "Illegal invocation: worker fetch needs the browser global receiver"
        );
      }
      const url = new URL(String(input));
      if (url.hostname !== "www.googleapis.com") {
        return realFetch.call(globalThis, input, init);
      }
      if (fixture.offline) {
        throw new TypeError("Controlled offline transport");
      }
      if (url.pathname.endsWith("/about")) {
        return Response.json({
          user: {
            permissionId: "drive-account-a",
            emailAddress: "drive-fixture@example.test",
          },
        });
      }
      if (url.pathname.endsWith("/generateIds")) {
        return Response.json({ ids: ["drive-file-" + fixture.nextId++] });
      }
      if (init?.method === "POST") {
        const body = new Uint8Array(
          await new Response(init.body).arrayBuffer()
        );
        const prefix = new TextDecoder().decode(body.slice(0, 1000));
        const id = /"id":"([^"]+)"/.exec(prefix)![1];
        if (fixture.files[id]) {
          return new Response(null, { status: 409 });
        }
        const marker = new TextEncoder().encode(
          "Content-Type: application/gzip\r\n\r\n"
        );
        let start = -1;
        for (let index = 0; index < body.length - marker.length; index++) {
          if (marker.every((byte, offset) => body[index + offset] === byte)) {
            start = index + marker.length;
            break;
          }
        }
        const boundary = new Headers(init.headers)
          .get("Content-Type")!
          .split("boundary=")[1];
        const suffix = new TextEncoder().encode(
          "\r\n--" + boundary + "--\r\n"
        ).length;
        fixture.files[id] = Array.from(body.slice(start, body.length - suffix));
        return Response.json({ id });
      }
      const id = url.pathname.split("/").at(-1)!;
      if (id === "files") {
        return Response.json({
          files: Object.keys(fixture.files).map((id) => ({ id })),
        });
      }
      return fixture.files[id]
        ? new Response(new Uint8Array(fixture.files[id]))
        : new Response(null, { status: 404 });
    };
  });
}

test.afterEach(async ({ extensionContext }) => {
  const worker = extensionContext.serviceWorkers()[0];
  if (worker) {
    await worker
      .evaluate(async () => {
        const restore = (
          globalThis as unknown as { driveFixtureRestore?: () => void }
        ).driveFixtureRestore;
        if (restore) {
          restore();
          await chrome.alarms.clear("drive-sync");
        }
      })
      .catch(() => {});
  }
});

test("Drive status explains missing setup without advertising cloud durability", async ({
  optionsPage,
}) => {
  test.skip(
    !!driveConfiguration.clientId,
    "Setup-required UI applies only while the shared clientId is empty."
  );
  await new OptionsPage(optionsPage).clickTab("settings");
  await optionsPage
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  await expect(optionsPage.getByTestId("drive-sync-panel")).toContainText(
    "OAuth setup"
  );
  await expect(optionsPage.getByTestId("drive-sync-panel")).toContainText(
    "config/google-drive.json"
  );
  await expect(
    optionsPage.getByRole("button", {
      name: "Connect",
      exact: true,
    })
  ).toBeDisabled();
});

test("the unpacked production build has the shared stable extension identity", async ({
  optionsPage,
}) => {
  expect(new URL(optionsPage.url()).host).toBe(driveConfiguration.extensionId);
  const manifest = await optionsPage.evaluate(() =>
    chrome.runtime.getManifest()
  );
  expect(manifest.key).toBe(driveConfiguration.publicKey);
  expect(manifest.oauth2?.client_id).toBe(
    driveConfiguration.clientId || undefined
  );
});

test("automatic Drive upload, offline save and clean-install hydration preserve visible scripts settings and layout", async ({
  optionsPage,
  extensionContext,
  clearStorage,
}) => {
  test.setTimeout(90_000);
  await clearStorage(optionsPage);
  const worker = extensionContext.serviceWorkers()[0];
  await driveGateway(worker);
  expect(
    await worker.evaluate(() => chrome.runtime.getManifest().oauth2.client_id)
  ).toBe(
    driveConfiguration.clientId || "123-fixture.apps.googleusercontent.com"
  );
  await new OptionsPage(optionsPage).clickTab("settings");
  await optionsPage
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  await optionsPage
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  await expectSyncedAndOpenSettings(optionsPage);
  await new OptionsPage(optionsPage).clickTab("settings");
  const source = buildUserscript({
    id: "drive-e2e",
    moduleName: "drive-e2e",
    name: "Drive persistent script",
    enabled: false,
  });
  await optionsPage.evaluate(
    (script) =>
      chrome.runtime.sendMessage({
        type: "publication.commit",
        command: {
          requestId: "drive-create",
          writes: [{ id: script.id, expectedRevision: null, script }],
        },
      }),
    source
  );
  await new OptionsPage(optionsPage).clickTab("scripts");
  await new ScriptsPage(optionsPage).selectScript(source.name);
  await worker.evaluate(() => {
    (
      globalThis as unknown as { driveFixture: { offline: boolean } }
    ).driveFixture.offline = true;
  });
  await replaceMonacoEditorContent(
    typescriptEditor(optionsPage),
    "export const persistentOfflineValue = 42;"
  );
  await saveMonacoEditor(optionsPage);
  await expect
    .poll(() =>
      optionsPage.evaluate(async () => {
        const snapshot = await chrome.runtime.sendMessage({
          type: "publication.read",
        });
        return snapshot.documents.find(
          (item: { script: { id: string } }) => item.script.id === "drive-e2e"
        )?.script.code.source.typescript;
      })
    )
    .toContain("persistentOfflineValue");
  await expect
    .poll(() =>
      optionsPage.evaluate(
        async () =>
          (
            await chrome.runtime.sendMessage({
              type: "publication.drive.status",
            })
          ).phase
      )
    )
    .toBe("offline");
  await new OptionsPage(optionsPage).clickTab("settings");
  await optionsPage
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  await optionsPage
    .locator("label")
    .filter({ hasText: /^Font size$/ })
    .locator("..")
    .getByRole("spinbutton")
    .fill("20");
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "publication.drive.layout.write",
      value: {
        activeSidebarTab: "modules",
        panelSizes: { scriptListSidebarWidth: 39 },
      },
    })
  );
  // Let the normal UI debounce finish, then set the layout to restore after reinstall.
  await expect
    .poll(() =>
      optionsPage.evaluate(async () => {
        const snapshot = await chrome.runtime.sendMessage({
          type: "publication.read",
        });
        return snapshot.settings.fontSize;
      })
    )
    .toBe(20);
  await optionsPage.waitForTimeout(650);
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "publication.drive.layout.write",
      value: {
        activeSidebarTab: "modules",
        panelSizes: { scriptListSidebarWidth: 39 },
      },
    })
  );
  await worker.evaluate(() => {
    (
      globalThis as unknown as { driveFixture: { offline: boolean } }
    ).driveFixture.offline = false;
  });
  // Same trigger used by the automatic retry alarm, without waiting a wall-clock minute.
  await worker.evaluate(() =>
    chrome.alarms.create("drive-sync", { when: Date.now() + 50 })
  );
  await expectSyncedAndOpenSettings(optionsPage);
  await expect(
    optionsPage.getByRole("button", { name: "Disconnect", exact: true })
  ).toBeVisible();
  await optionsPage
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(optionsPage.getByTestId("drive-sync-panel")).toContainText(
    "Google Drive is disconnected"
  );
  await expect(
    optionsPage.getByRole("button", { name: "Upload now", exact: true })
  ).toHaveCount(0);
  const countBefore = await worker.evaluate(
    () =>
      Object.keys(
        (
          globalThis as unknown as {
            driveFixture: { files: Record<string, number[]> };
          }
        ).driveFixture.files
      ).length
  );
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "publication.drive.layout.write",
      value: {
        activeSidebarTab: "modules",
        panelSizes: { scriptListSidebarWidth: 40 },
      },
    })
  );
  await expect
    .poll(() =>
      optionsPage.evaluate(
        async () =>
          (
            await chrome.runtime.sendMessage({
              type: "publication.drive.status",
            })
          ).pending
      )
    )
    .toBeGreaterThan(0);
  await optionsPage.reload();
  await new OptionsPage(optionsPage).waitForReady();
  await new OptionsPage(optionsPage).clickTab("settings");
  await optionsPage
    .getByRole("button", { name: "Advanced", exact: true })
    .click();
  await worker.evaluate(() =>
    chrome.alarms.create("drive-sync", { when: Date.now() + 50 })
  );
  await expect
    .poll(() =>
      worker.evaluate(
        async () => (await chrome.alarms.get("drive-sync")) === undefined
      )
    )
    .toBe(true);
  await expect(
    optionsPage.getByRole("button", { name: "Connect", exact: true })
  ).toBeVisible();
  await expect(optionsPage.getByTestId("drive-sync-panel")).toContainText(
    "Google Drive is disconnected"
  );
  expect(
    await worker.evaluate(
      () =>
        Object.keys(
          (
            globalThis as unknown as {
              driveFixture: { files: Record<string, number[]> };
            }
          ).driveFixture.files
        ).length
    )
  ).toBe(countBefore);
  await optionsPage
    .getByRole("button", { name: "Connect", exact: true })
    .click();
  await expectSyncedAndOpenSettings(optionsPage);
  await expect(
    optionsPage.getByRole("button", { name: "Disconnect", exact: true })
  ).toBeVisible();
  await optionsPage.waitForTimeout(650);
  await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "publication.drive.layout.write",
      value: {
        activeSidebarTab: "modules",
        panelSizes: { scriptListSidebarWidth: 40 },
      },
    })
  );
  await expect
    .poll(() =>
      optionsPage.evaluate(
        async () =>
          (
            await chrome.runtime.sendMessage({
              type: "publication.drive.status",
            })
          ).pending
      )
    )
    .toBe(0);
  const remote = await worker.evaluate(
    () =>
      (
        globalThis as unknown as {
          driveFixture: { files: Record<string, number[]> };
        }
      ).driveFixture.files
  );
  expect(Object.keys(remote).length).toBeGreaterThan(0);
  // All installation-owned state disappears; retained Drive bytes are external.
  await clearStorage(optionsPage);
  const dist = path.resolve(import.meta.dirname, "../../dist");
  const restoredContext = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
    ],
  });
  try {
    const restarted =
      restoredContext.serviceWorkers()[0] ??
      (await restoredContext.waitForEvent("serviceworker"));
    await driveGateway(restarted);
    expect(
      await restarted.evaluate(
        () => chrome.runtime.getManifest().oauth2.client_id
      )
    ).toBe(
      driveConfiguration.clientId || "123-fixture.apps.googleusercontent.com"
    );
    await restarted.evaluate((files) => {
      const fixture = (
        globalThis as unknown as {
          driveFixture: { files: Record<string, number[]>; nextId: number };
        }
      ).driveFixture;
      fixture.files = files;
      fixture.nextId = Object.keys(files).length + 10;
    }, remote);
    const permission = await restoredContext.newPage();
    await permission.goto(
      "chrome://extensions/?id=" + new URL(restarted.url()).host
    );
    const allow = permission.getByRole("button", {
      name: /^Allow User Scripts/,
    });
    await allow.waitFor();
    if ((await allow.getAttribute("aria-pressed")) !== "true") {
      await allow.click();
    }
    await permission.close();
    const restored = await restoredContext.newPage();
    await restored.goto(
      "chrome-extension://" + new URL(restarted.url()).host + "/options.html"
    );
    // Identity is mocked after worker startup, so trigger its normal automatic
    // retry alarm. No local mode flag, Connect action or manual download is used.
    await restarted.evaluate(() =>
      chrome.alarms.create("drive-sync", { when: Date.now() + 50 })
    );
    await expect(restored.getByTitle("Modules")).toHaveClass(/bg-selected/);
    const layout = await restored.evaluate(() =>
      chrome.runtime.sendMessage({ type: "publication.drive.layout.read" })
    );
    expect(layout.layout.panelSizes.scriptListSidebarWidth).toBe(40);
    await new OptionsPage(restored).clickTab("settings");
    await expect(
      restored
        .locator("label")
        .filter({ hasText: /^Font size$/ })
        .locator("..")
        .getByRole("spinbutton")
    ).toHaveValue("20");
    await new OptionsPage(restored).clickTab("scripts");
    await new ScriptsPage(restored).selectScript(source.name);
    await expect
      .poll(async () =>
        (await readTypescriptEditorText(restored)).replace(/\s/g, "")
      )
      .toContain("persistentOfflineValue=42");
    const saved = await restored.evaluate(() =>
      chrome.runtime.sendMessage({ type: "publication.read" })
    );
    expect(
      saved.documents.find(
        (item: { script: { id: string } }) => item.script.id === "drive-e2e"
      ).script.code.source.typescript
    ).toContain("persistentOfflineValue = 42");
    await restored.close();
  } finally {
    await restoredContext.close();
  }
});
