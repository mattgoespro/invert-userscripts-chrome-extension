import { GlobalModule, Userscript } from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import { matchesUrlPattern } from "@shared/url-matching";

export async function injectMatchingScripts(
  tabId: number,
  url: string,
  timing: "beforePageLoad" | "afterPageLoad"
): Promise<void> {
  try {
    // Parallelize independent storage reads
    const [scriptsMap, compiledCodeMap] = await Promise.all([
      ChromeSyncStorage.getAllScripts(),
      CompiledCodeStorage.getAllCompiledCode(),
    ]);

    const allScripts = Object.values(scriptsMap);

    // Filter before merging compiled code to avoid unnecessary object spreading
    const matchingScripts = allScripts.filter(
      (script) =>
        script.enabled &&
        script.runAt === timing &&
        matchesUrlPattern(url, script.urlPatterns)
    );

    if (matchingScripts.length === 0) {
      return;
    }

    // Merge compiled code only for scripts that will actually be injected
    const mergeCompiled = (script: Userscript): Userscript => {
      const compiled = compiledCodeMap[script.id];
      if (compiled) {
        return {
          ...script,
          code: {
            ...script.code,
            compiled: {
              javascript:
                compiled.javascript || script.code.compiled.javascript,
              css: compiled.css || script.code.compiled.css,
            },
          },
        };
      }
      return script;
    };

    const resolvedScripts = matchingScripts.map(mergeCompiled);

    // Build a lookup map for shared script resolution (O(1) vs O(n) per lookup)
    const scriptById = new Map(allScripts.map((s) => [s.id, s]));

    // Phase 1: Inject CDN modules (deduplicated, only fetch modules if needed)
    const needsCdnModules = resolvedScripts.some(
      (s) => s.globalModules?.length > 0
    );

    if (needsCdnModules) {
      const modulesMap = await ChromeSyncStorage.getAllModules();
      const injectedModules = new Set<string>();

      for (const script of resolvedScripts) {
        if (script.globalModules?.length > 0) {
          for (const moduleId of script.globalModules) {
            if (!injectedModules.has(moduleId)) {
              const module = modulesMap[moduleId];
              if (module?.enabled) {
                await injectCdnModule(tabId, module);
                injectedModules.add(moduleId);
              }
            }
          }
        }
      }
    }

    // Phase 2: Inject shared script dependencies, then Phase 3: userscripts
    const injectedShared = new Set<string>();

    for (const script of resolvedScripts) {
      if (script.sharedScripts?.length > 0) {
        for (const sharedId of script.sharedScripts) {
          if (injectedShared.has(sharedId)) {
            continue;
          }
          const shared = scriptById.get(sharedId);

          if (shared?.shared && shared?.moduleName) {
            const resolvedShared = mergeCompiled(shared);
            if (resolvedShared.code?.compiled?.javascript) {
              await injectSharedScript(tabId, resolvedShared);
              injectedShared.add(sharedId);
            }
          }
        }
      }
      await injectScript(tabId, script);
      await injectStylesheet(tabId, script);
    }
  } catch (error) {
    console.error("Error injecting scripts: ", error);
  }
}

export async function injectScript(
  tabId: number,
  script: Userscript
): Promise<void> {
  try {
    const jsCode = script.code?.compiled?.javascript ?? "";

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (code: string) => {
        try {
          const scriptEl = document.createElement("script");
          scriptEl.textContent = code;
          document.head.appendChild(scriptEl);
          scriptEl.remove();
        } catch (error) {
          console.error("Error executing userscript: ", error);
        }
      },
      args: [jsCode],
      world: "MAIN",
    });
    console.log(`Injected script: ${script.name} into tab ${tabId}`);
  } catch (error) {
    console.error(`Error injecting script ${script.name}:`, error);
  }
}

async function injectSharedScript(
  tabId: number,
  script: Userscript
): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (code: string) => {
        try {
          const scriptEl = document.createElement("script");
          scriptEl.textContent = code;
          document.head.appendChild(scriptEl);
          scriptEl.remove();
        } catch (error) {
          console.error("Error executing shared script: ", error);
        }
      },
      args: [script.code.compiled.javascript],
      world: "MAIN",
    });
    console.log(`Injected shared script: ${script.name} into tab ${tabId}`);
  } catch (error) {
    console.error(`Error injecting shared script ${script.name}:`, error);
  }
}

/**
 * Injects a CDN module into the page by creating a `<script src="url">` element.
 * Waits for the script to load before resolving so that downstream userscripts
 * can safely reference globals provided by the module.
 */
async function injectCdnModule(
  tabId: number,
  module: GlobalModule
): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (url: string) => {
        return new Promise<void>((resolve) => {
          const scriptEl = document.createElement("script");
          scriptEl.src = url;
          scriptEl.onload = () => resolve();
          scriptEl.onerror = () => {
            console.warn(`Failed to load CDN module: ${url}`);
            resolve();
          };
          document.head.appendChild(scriptEl);
        });
      },
      args: [module.url],
      world: "MAIN",
    });
    console.log(`Injected CDN module: ${module.name} into tab ${tabId}`);
  } catch (error) {
    console.error(`Error injecting CDN module ${module.name}:`, error);
  }
}

/**
 * Injects compiled CSS into a tab using `chrome.scripting.insertCSS`.
 * Skips injection if the script has no compiled CSS.
 */
async function injectStylesheet(
  tabId: number,
  script: Userscript
): Promise<void> {
  const cssCode = script.code?.compiled?.css ?? "";

  if (!cssCode) {
    return;
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      css: cssCode,
    });
    console.log(`Injected stylesheet: ${script.name} into tab ${tabId}`);
  } catch (error) {
    console.error(`Error injecting stylesheet ${script.name}:`, error);
  }
}
