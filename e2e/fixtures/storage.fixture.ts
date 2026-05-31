import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { extensionTest } from "./extension.fixture";

interface StorageFixtures {
  /**
   * Clears both chrome.storage.sync and chrome.storage.local.
   * Must be called with a page opened on a chrome-extension:// origin.
   */
  clearStorage: (page: Page) => Promise<void>;
  /**
   * Seeds chrome.storage.sync and optionally chrome.storage.local with the
   * provided data. Must be called with a page opened on a chrome-extension:// origin.
   */
  seedStorage: (
    page: Page,
    syncData: Record<string, unknown>,
    localData?: Record<string, unknown>
  ) => Promise<void>;
}

/**
 * Merged test fixture that includes extension fixtures (context, extensionId,
 * optionsPage, popupPage) plus chrome.storage helpers.
 *
 * Import `test` and `expect` from `e2e/fixtures/index.ts` in all test files.
 */
export const test = extensionTest.extend<StorageFixtures>({
  clearStorage: async ({}, use) => {
    const clear = async (page: Page) => {
      await page.evaluate(async () => {
        await Promise.all([
          chrome.storage.sync.clear(),
          chrome.storage.local.clear(),
        ]);
      });
    };

    await use(clear);
  },

  seedStorage: async ({}, use) => {
    const seed = async (
      page: Page,
      syncData: Record<string, unknown>,
      localData?: Record<string, unknown>
    ) => {
      // ChromeSyncStorage stores userscripts as compressed manifests at
      // "userscript:<id>" keys. Tests seed raw Userscript objects, so convert
      // "userscript:<id>" entries to the legacy "userscripts" blob format which
      // ChromeSyncStorage.getAllScripts() still reads and migrates automatically.
      const legacyScripts: Record<string, unknown> = {};
      const otherSyncData: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(syncData)) {
        if (key.startsWith("userscript:")) {
          const id = key.slice("userscript:".length);
          legacyScripts[id] = value;
        } else {
          otherSyncData[key] = value;
        }
      }

      const finalSyncData: Record<string, unknown> = { ...otherSyncData };

      if (Object.keys(legacyScripts).length > 0) {
        finalSyncData["userscripts"] = legacyScripts;
      }

      await page.evaluate(
        async ({ sync, local }) => {
          await chrome.storage.sync.set(sync);

          if (Object.keys(local).length > 0) {
            await chrome.storage.local.set(local);
          }
        },
        { sync: finalSyncData, local: localData ?? {} }
      );
    };

    await use(seed);
  },
});

export { expect };
