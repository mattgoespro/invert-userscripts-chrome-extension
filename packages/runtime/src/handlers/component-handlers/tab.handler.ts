import { updateBadgeForTab } from "../../ide/badge";
import { isInjectablePage } from "@shared/injection-eligibility";
import {
  injectMatchingScripts,
  loadRuntimeInjectionState,
  prepareTabForInjection,
} from "../../ide/scripts";

export const onTabUpdated = async (
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab
): Promise<void> => {
  const url = changeInfo.url ?? tab.pendingUrl ?? tab.url ?? "";
  if (changeInfo.status === "loading") {
    await prepareTabForInjection(tabId);
    if (!isInjectablePage(url)) {
      await updateBadgeForTab(tabId, url);
      return;
    }
    const injectionState = await loadRuntimeInjectionState();
    await injectMatchingScripts(tabId, url, "beforePageLoad", injectionState);
    await updateBadgeForTab(tabId, url, injectionState.scriptsMap);
  } else if (changeInfo.url) {
    await updateBadgeForTab(tabId, url);
  }
};

export const onTabRemoved = async (tabId: number): Promise<void> => {
  await prepareTabForInjection(tabId);
};

export const onTabActivated = async (
  activeInfo: chrome.tabs.OnActivatedInfo
): Promise<void> => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await updateBadgeForTab(activeInfo.tabId, tab.pendingUrl ?? tab.url ?? "");
  } catch (error) {
    console.error("Error updating badge on tab activation:", error);
  }
};
