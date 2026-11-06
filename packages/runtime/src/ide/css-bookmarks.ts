const SESSION_KEY = "injectCssBookmarks";

interface CssBookmark {
  css: string;
  documentId?: string;
}
type CssBookmarks = Record<string, CssBookmark>;

let memoryBookmarks: CssBookmarks | null = null;
let loadPromise: Promise<CssBookmarks> | null = null;
let mutations = Promise.resolve();

function bookmarkKey(tabId: number, scriptId: string): string {
  return `${tabId}:${scriptId}`;
}

async function readBookmarks(): Promise<CssBookmarks> {
  if (memoryBookmarks) {
    return memoryBookmarks;
  }

  if (!loadPromise) {
    loadPromise = chrome.storage.session
      .get(SESSION_KEY)
      .then((result) => {
        memoryBookmarks =
          (result[SESSION_KEY] as CssBookmarks | undefined) ?? {};
        return memoryBookmarks;
      })
      .catch((error) => {
        console.warn("Failed to load CSS inject bookmarks:", error);
        throw error;
      })
      .finally(() => {
        loadPromise = null;
      });
  }

  return loadPromise;
}

async function writeBookmarks(bookmarks: CssBookmarks): Promise<void> {
  try {
    await chrome.storage.session.set({ [SESSION_KEY]: bookmarks });
    memoryBookmarks = bookmarks;
  } catch (error) {
    console.warn("Failed to persist CSS inject bookmarks:", error);
    throw error;
  }
}

/**
 * With `documentId`, only a bookmark for that document counts: a write landing
 * after navigation describes the previous document's styles, not the new one's.
 */
export async function getCssBookmark(
  tabId: number,
  scriptId: string,
  documentId?: string
): Promise<string | undefined> {
  await mutations;
  const bookmarks = await readBookmarks();
  const bookmark = bookmarks[bookmarkKey(tabId, scriptId)];
  if (
    documentId &&
    bookmark?.documentId &&
    bookmark.documentId !== documentId
  ) {
    return undefined;
  }
  return bookmark?.css;
}

function mutateBookmarks(
  change: (bookmarks: CssBookmarks) => void
): Promise<void> {
  const task = mutations.then(async () => {
    const bookmarks = { ...(await readBookmarks()) };
    change(bookmarks);
    await writeBookmarks(bookmarks);
  });
  mutations = task.catch(() => {});
  return task;
}
export function setCssBookmark(
  tabId: number,
  scriptId: string,
  css: string,
  documentId?: string
): Promise<void> {
  return mutateBookmarks((bookmarks) => {
    bookmarks[bookmarkKey(tabId, scriptId)] = {
      css,
      ...(documentId ? { documentId } : {}),
    };
  });
}
export function clearCssBookmark(
  tabId: number,
  scriptId: string
): Promise<void> {
  return mutateBookmarks((bookmarks) => {
    delete bookmarks[bookmarkKey(tabId, scriptId)];
  });
}
export function clearCssBookmarksForTab(
  tabId: number,
  keepDocumentId?: string
): Promise<void> {
  return mutateBookmarks((bookmarks) => {
    for (const key of Object.keys(bookmarks)) {
      if (
        key.startsWith(`${tabId}:`) &&
        (!keepDocumentId || bookmarks[key].documentId !== keepDocumentId)
      ) {
        delete bookmarks[key];
      }
    }
  });
}
