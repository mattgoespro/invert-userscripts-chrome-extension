import { updateBadgeForTab } from "../../ide/badge";
import { isInjectablePage } from "@shared/injection-eligibility";
import {
  injectMatchingScripts,
  loadRuntimeInjectionState,
} from "../../ide/scripts";

export const onWebNavigationCompleted = async (
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails
): Promise<void> => {
  if (details.frameId === 0) {
    if (!isInjectablePage(details.url)) {
      await updateBadgeForTab(details.tabId, details.url);
      return;
    }
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
