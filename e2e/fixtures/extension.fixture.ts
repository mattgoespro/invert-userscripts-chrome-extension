import {
  chromium,
  test as base,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import os from "os";
import path from "path";

const EXTENSION_DIST_PATH = path.resolve(import.meta.dirname, "../../dist");

// Mirror the top-level playwright.config.ts HEADLESS flag so launchPersistentContext
// matches the project-level headless setting.
const headless = process.env["HEADLESS"] === "true";

/** Test-scoped fixtures (a new instance per test). */
interface ExtensionTestFixtures {
  optionsPage: Page;
  popupPage: Page;
}

/** Worker-scoped fixtures (shared across tests in the same worker). */
interface ExtensionWorkerFixtures {
  extensionContext: BrowserContext;
  extensionId: string;
}

export const extensionTest = base.extend<
  ExtensionTestFixtures,
  ExtensionWorkerFixtures
>({
  extensionContext: [
    async ({}, use) => {
      const userDataDir = path.join(
        os.tmpdir(),
        `playwright-ext-${Date.now()}`
      );

      // Chrome extensions require headed mode or --headless=new (not the legacy
      // --headless flag). Always set headless:false and pass --headless=new as a
      // Chrome arg when headless mode is requested so the extension loads correctly.
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
          ...(headless ? ["--headless=new"] : []),
          "--no-first-run",
          "--no-default-browser-check",
          `--disable-extensions-except=${EXTENSION_DIST_PATH}`,
          `--load-extension=${EXTENSION_DIST_PATH}`,
        ],
      });

      await use(context);
      await context.close();
    },
    { scope: "worker" },
  ],

  extensionId: [
    async ({ extensionContext }, use) => {
      // Set up the listener BEFORE checking serviceWorkers() to avoid a race
      // condition where the SW fires during launchPersistentContext setup and
      // the event is already gone by the time we call waitForEvent.
      const swPromise = extensionContext.waitForEvent("serviceworker", {
        timeout: 30_000,
      });
      const existing = extensionContext.serviceWorkers()[0];
      const serviceWorker = existing ?? (await swPromise);

      const match = serviceWorker.url().match(/chrome-extension:\/\/([^/]+)/);

      if (!match) {
        throw new Error(
          `[e2e] Could not extract extension ID from service worker URL: ${serviceWorker.url()}`
        );
      }

      await use(match[1]);
    },
    { scope: "worker" },
  ],

  optionsPage: async ({ extensionContext, extensionId }, use) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    // Wait for the sidebar to be visible — reliable for all storage states.
    // Tests/POMs wait for Monaco themselves when they need an editor.
    await page.waitForSelector('[title="Scripts"]', { timeout: 15_000 });
    await use(page);
    await page.close();
  },

  popupPage: async ({ extensionContext, extensionId }, use) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await use(page);
    await page.close();
  },
});
