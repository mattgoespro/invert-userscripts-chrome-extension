import { updateBadgeForTab } from "../../ide/badge";
import {
  injectMatchingScripts,
  loadRuntimeInjectionState,
} from "../../ide/scripts";

export const onTabUpdated = async (
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab
): Promise<void> => {
  if (changeInfo.status === "loading" && tab.url) {
    const injectionState = await loadRuntimeInjectionState();
    await injectMatchingScripts(
      tabId,
      tab.url,
      "beforePageLoad",
      injectionState
    );
    await updateBadgeForTab(tabId, tab.url, injectionState.scriptsMap);
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
