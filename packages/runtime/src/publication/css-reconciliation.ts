import type { IndexedDocumentRepository } from "@shared/storage/indexeddb/repository";
import { reconcileStylesForScripts } from "../ide/scripts";
let drain: Promise<void> | undefined;
export async function reconcilePendingCss(
  repository: IndexedDocumentRepository
): Promise<void> {
  if (drain) {
    return drain;
  }
  drain = (async () => {
    for (;;) {
      const pending = (await repository.state()).cssOutbox ?? {};
      if (!Object.keys(pending).length) {
        break;
      }
      await chrome.alarms.create("publication-css-retry", {
        delayInMinutes: 0.5,
      });
      await reconcileStylesForScripts(Object.keys(pending));
      await repository.update((state) => {
        state.cssOutbox ??= {};
        for (const [id, token] of Object.entries(pending)) {
          if (state.cssOutbox[id] === token) {
            delete state.cssOutbox[id];
          }
        }
        return { state, value: undefined };
      });
    }
    await chrome.alarms.clear("publication-css-retry");
    await chrome.storage.local.set({
      publicationCssStatus: { status: "ready" },
    });
  })()
    .catch(async (error) => {
      await chrome.storage.local.set({
        publicationCssStatus: {
          status: "pending",
          message: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    })
    .finally(() => {
      drain = undefined;
    });
  return drain;
}
