import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { extensionTest } from "./extension.fixture";
import { buildUserscriptSyncEntries } from "./userscript-storage";

interface StorageFixtures {
  /**
   * Clears both `chrome.storage.sync` and `chrome.storage.local`.
   * Must be called with a page opened on a chrome-extension:// origin.
   */
  clearStorage: (page: Page) => Promise<void>;
  /**
   * Seeds `chrome.storage.sync` and optionally `chrome.storage.local` with the
   * provided data. Must be called with a page opened on a _chrome-extension://_ origin.
   */
  seedStorage: (
    page: Page,
    syncData: Record<string, unknown>,
    localData?: Record<string, unknown>
  ) => Promise<void>;
}

/**
 * Merged test fixture that includes extension fixtures (`context`, `extensionId`,
 * `optionsPage`, `popupPage`) plus `chrome.storage` helpers.
 *
 * Import `test` and `expect` from `e2e/fixtures/index.ts` in all test files.
 */
export const test = extensionTest.extend<StorageFixtures>({
  clearStorage: async ({}, use) => {
    const clear = async (page: Page) => {
      // The already-open options page may still have a debounced UI-state save
      // pending from its initial hydration. Let that settle before test setup
      // clears storage, otherwise a reload can rewrite stale globalState.
      await page.waitForTimeout(600);

      await page.evaluate(async () => {
        await chrome.storage.local.set({ publicationBackend: "legacy" });
        await Promise.all([
          chrome.storage.sync.clear(),
          chrome.storage.local.clear(),
        ]);
        if (
          !(await indexedDB.databases()).some(
            (database) => database.name === "invert-ide-documents"
          )
        ) {
          return;
        }
        const open = indexedDB.open("invert-ide-documents", 1);
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          open.onsuccess = () => resolve(open.result);
          open.onerror = () => reject(open.error);
        });
        if (db.objectStoreNames.contains("repository")) {
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction("repository", "readwrite");
            transaction.objectStore("repository").clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          });
        }
        db.close();
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
      // See clearStorage above: ensure the live page has finished any pending
      // debounced writes before test setup seeds a replacement storage state.
      await page.waitForTimeout(600);

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
