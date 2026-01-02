import { injectMatchingScripts } from "../../ide/scripts";

export const onInstalled = (_details: chrome.runtime.InstalledDetails) => {
  console.log("Invert IDE Userscripts extension installed.");
};

export const onMessage = (
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "action" in message &&
    message.action === "reloadScripts"
  ) {
    chrome.tabs.query({}, async (tabs) => {
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          await injectMatchingScripts(tab.id, tab.url);
        }
      }
    });
    sendResponse({ success: true });
  }
  return true;
};
