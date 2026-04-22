import { updateBadgeForTab } from "../../ide/badge";
import { injectMatchingScripts } from "../../ide/scripts";

export const onTabUpdated = async (
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab
): Promise<void> => {
  if (changeInfo.status === "loading" && tab.url) {
    await injectMatchingScripts(tabId, tab.url, "beforePageLoad");
    await updateBadgeForTab(tabId, tab.url);
  }
};

export const onTabActivated = async (
  activeInfo: chrome.tabs.OnActivatedInfo
): Promise<void> => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await updateBadgeForTab(activeInfo.tabId, tab.url);
    }
  } catch (error) {
    console.error("Error updating badge on tab activation:", error);
  }
};
