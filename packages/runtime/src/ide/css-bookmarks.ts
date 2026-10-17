const SESSION_KEY = "injectCssBookmarks";

type CssBookmarks = Record<string, string>;

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

export async function getCssBookmark(
  tabId: number,
  scriptId: string
): Promise<string | undefined> {
  await mutations;
  const bookmarks = await readBookmarks();
  return bookmarks[bookmarkKey(tabId, scriptId)];
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
  css: string
): Promise<void> {
  return mutateBookmarks((bookmarks) => {
    bookmarks[bookmarkKey(tabId, scriptId)] = css;
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
export function clearCssBookmarksForTab(tabId: number): Promise<void> {
  return mutateBookmarks((bookmarks) => {
    for (const key of Object.keys(bookmarks)) {
      if (key.startsWith(`${tabId}:`)) {
        delete bookmarks[key];
      }
    }
  });
}
