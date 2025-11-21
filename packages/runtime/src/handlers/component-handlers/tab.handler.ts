import { injectMatchingScripts } from '../../ide/scripts';

export const onTabUpdated = async (
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab
): Promise<void> => {
  if (changeInfo.status === 'loading' && tab.url) {
    await injectMatchingScripts(tabId, tab.url);
  }
};
chrome.tabs.onUpdated.addListener(onTabUpdated);
