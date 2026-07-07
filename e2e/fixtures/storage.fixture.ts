import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { extensionTest } from "./extension.fixture";
import { buildUserscriptSyncEntries } from "./userscript-storage";

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
      const finalSyncData = buildUserscriptSyncEntries(syncData);

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
