import { RuntimePortMessageEvent } from "@shared/messages";
import { updateBadgeForTab } from "../../ide/badge";
import {
  injectMatchingScripts,
  loadRuntimeInjectionState,
} from "../../ide/scripts";

export const onInstalled = (_details: chrome.runtime.InstalledDetails) => {
  console.log("Invert IDE Userscripts extension installed.");
};

export const onMessage = async (
  message: RuntimePortMessageEvent,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => {
  switch (message.type) {
    case "refreshTabs": {
      const [tabs, injectionState] = await Promise.all([
        chrome.tabs.query({}),
        loadRuntimeInjectionState(true),
      ]);

      for (const tab of tabs) {
        if (tab.id && tab.url) {
          await injectMatchingScripts(
            tab.id,
            tab.url,
            "beforePageLoad",
            injectionState
          );
          await injectMatchingScripts(
            tab.id,
            tab.url,
            "afterPageLoad",
            injectionState
          );
          await updateBadgeForTab(tab.id, tab.url, injectionState.scriptsMap);
        }
      }

      sendResponse({ success: true });
      break;
    }
  }

  return true;
};
