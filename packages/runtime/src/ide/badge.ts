import { Userscripts } from "@shared/model";
import { ChromeSyncStorage } from "@shared/storage";
import { matchesUrlPattern } from "@shared/url-matching";
import { isInjectablePage } from "@shared/injection-eligibility";

export function countMatchingScripts(
  url: string,
  scriptsMap: Userscripts
): number {
  if (!isInjectablePage(url)) {
    return 0;
  }
  return Object.values(scriptsMap).filter((script) =>
    matchesUrlPattern(url, script.urlPatterns)
  ).length;
}

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
  url: string,
  scriptsMap?: Userscripts
): Promise<void> {
  try {
    const eligible = isInjectablePage(url);
    const matchingCount = eligible
      ? countMatchingScripts(
          url,
          scriptsMap ?? (await ChromeSyncStorage.getAllScripts())
        )
      : 0;

    await chrome.action.setBadgeText({
      tabId,
      text: eligible ? (matchingCount > 0 ? String(matchingCount) : "") : "–",
    });

    await chrome.action.setBadgeBackgroundColor({
      tabId,
      color: eligible ? "#FBBF24" : "#6B7280",
    });
    await chrome.action.setTitle({
      tabId,
      title: eligible
        ? "Invert IDE Userscripts"
        : "Invert IDE — Scripts cannot run on this page",
    });
  } catch (error) {
    console.error("Error updating badge for tab:", error);
  }
}
