import { injectMatchingScripts } from '@/background/ide/scripts';

export const onInstalled = () => {
  console.log('Vertex IDE Userscripts extension installed');
};

export const onMessage: (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => void = (request, _sender, sendResponse) => {
  if (
    typeof request === 'object' &&
    request !== null &&
    'action' in request &&
    request.action === 'reloadScripts'
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
