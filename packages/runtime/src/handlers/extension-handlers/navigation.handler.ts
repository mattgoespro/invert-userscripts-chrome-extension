import { injectMatchingScripts } from '../../ide/scripts';

export const onWebNavigationCompleted = async (
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails
): Promise<void> => {
  if (details.frameId === 0) {
    await injectMatchingScripts(details.tabId, details.url);
  }
};
