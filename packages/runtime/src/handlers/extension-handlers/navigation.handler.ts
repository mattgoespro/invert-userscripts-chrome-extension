import { updateBadgeForTab } from "../../ide/badge";
import {
  injectMatchingScripts,
  loadRuntimeInjectionState,
} from "../../ide/scripts";

export const onWebNavigationCompleted = async (
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails
): Promise<void> => {
  if (details.frameId === 0) {
    const injectionState = await loadRuntimeInjectionState();
    await injectMatchingScripts(
      details.tabId,
      details.url,
      "afterPageLoad",
      injectionState
    );
    await updateBadgeForTab(
      details.tabId,
      details.url,
      injectionState.scriptsMap
    );
  }
};
