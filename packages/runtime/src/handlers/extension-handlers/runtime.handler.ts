import { injectMatchingScripts } from "../../ide/scripts";

export const onInstalled = (_details: chrome.runtime.InstalledDetails) => {
  console.log("Invert IDE Userscripts extension installed.");
};

export const onMessage = (
  message: Record<string, unknown>,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => {
  switch (message.action) {
    case "reloadScripts":
      chrome.tabs.query({}, async (tabs) => {
        for (const tab of tabs) {
          if (tab.id != null && tab.url != null) {
            await injectMatchingScripts(tab.id, tab.url);
          }
        }
      });
      sendResponse({ success: true });
      break;
  }

  return true;
};
