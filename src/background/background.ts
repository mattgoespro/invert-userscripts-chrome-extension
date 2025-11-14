import { StorageManager } from '@/utils/storage';
import { UserScript } from '@/types';

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Vertex IDE Userscripts extension installed');
});

// Listen for tab updates to inject scripts
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    await injectMatchingScripts(tabId, tab.url);
  }
});

// Listen for navigation completed
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) {
    await injectMatchingScripts(details.tabId, details.url);
  }
});

async function injectMatchingScripts(tabId: number, url: string): Promise<void> {
  try {
    const scripts = await StorageManager.getScripts();
    const enabledScripts = scripts.filter((s) => s.enabled);

    for (const script of enabledScripts) {
      if (matchesUrlPattern(url, script.urlPatterns)) {
        await injectScript(tabId, script);
      }
    }
  } catch (error) {
    console.error('Error injecting scripts:', error);
  }
}

function matchesUrlPattern(url: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  });
}

async function injectScript(tabId: number, script: UserScript): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (code: string) => {
        try {
          // Create a script element to execute the code
          const scriptEl = document.createElement('script');
          scriptEl.textContent = code;
          (document.head || document.documentElement).appendChild(scriptEl);
          scriptEl.remove();
        } catch (error) {
          console.error('Error executing userscript:', error);
        }
      },
      args: [script.code],
      world: 'MAIN',
    });
    console.log(`Injected script: ${script.name} into tab ${tabId}`);
  } catch (error) {
    console.error(`Error injecting script ${script.name}:`, error);
  }
}

// Listen for messages from popup/options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'reloadScripts') {
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
});
