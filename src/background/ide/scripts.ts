import { UserScript } from '@/types';
import { IDEStorageManager } from '@/utils/storage';

export async function injectMatchingScripts(tabId: number, url: string): Promise<void> {
  try {
    const scripts = await IDEStorageManager.getScripts();
    const enabledScripts = scripts.filter((script) => script.enabled);

    for (const script of enabledScripts) {
      if (matchesUrlPattern(url, script.urlPatterns)) {
        await injectScript(tabId, script);
      }
    }
  } catch (error) {
    console.error('Error injecting scripts:', error);
  }
}

export function matchesUrlPattern(url: string, patterns: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => {
    // Convert glob pattern to regex with proper escaping
    // First escape all regex special characters except * and ?
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars including backslash
      .replace(/\*/g, '.*') // Convert * to .*
      .replace(/\?/g, '.'); // Convert ? to .

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  });
}

export async function injectScript(tabId: number, script: UserScript): Promise<void> {
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
