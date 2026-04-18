import { ChromeSyncStorage } from "@shared/storage";
import { matchesUrlPattern } from "@shared/url-matching";

/**
 * Updates the extension badge text and color for a specific tab based on
 * how many userscripts match the tab's URL. The count includes all matching
 * scripts (enabled and disabled).
 *
 * @param tabId - The ID of the tab to update the badge for
 * @param url - The URL of the tab to match against script URL patterns
 */
export async function updateBadgeForTab(
  tabId: number,
  url: string
): Promise<void> {
  try {
    const scriptsMap = await ChromeSyncStorage.getAllScripts();
    const allScripts = Object.values(scriptsMap);

    const matchingCount = allScripts.filter((script) =>
      matchesUrlPattern(url, script.urlPatterns)
    ).length;

    await chrome.action.setBadgeText({
      tabId,
      text: matchingCount > 0 ? String(matchingCount) : "",
    });

    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: "#4C8EFF",
    });
  } catch (error) {
    console.error("Error updating badge for tab:", error);
  }
}
