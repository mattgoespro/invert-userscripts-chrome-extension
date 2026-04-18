import { Userscript, GlobalModule } from "../../../shared/src/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import { matchesUrlPattern } from "@shared/url-matching";

/**
 * Wraps a shared script's compiled JavaScript so its exports are registered
 * on `window.__INVERT_SHARED__["scriptName"]` for consumption by other scripts.
 */
function wrapSharedScriptForInjection(
  moduleName: string,
  compiledJs: string
): string {
  let code = compiledJs;
  const exportedNames: string[] = [];

  // export const/let/var name = ...
  code = code.replace(
    /^export\s+(const|let|var)\s+(\w+)/gm,
    (_match, decl, varName) => {
      exportedNames.push(varName);
      return `${decl} ${varName}`;
    }
  );

  // export function name(...)
  code = code.replace(/^export\s+function\s+(\w+)/gm, (_match, fnName) => {
    exportedNames.push(fnName);
    return `function ${fnName}`;
  });

  // export class name
  code = code.replace(/^export\s+class\s+(\w+)/gm, (_match, className) => {
    exportedNames.push(className);
    return `class ${className}`;
  });

  // export default ...
  code = code.replace(/^export\s+default\s+/gm, () => {
    exportedNames.push("default");
    return "const __default__ = ";
  });

  // export { a, b, c } or export { a as b }
  code = code.replace(/^export\s*\{([^}]+)\}\s*;?/gm, (_match, names) => {
    const nameList = (names as string)
      .split(",")
      .map((n: string) => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      })
      .filter(Boolean);
    exportedNames.push(...nameList);
    return "";
  });

  const assignments = exportedNames
    .map((n) =>
      n === "default"
        ? `__ns__["default"]=__default__`
        : `__ns__[${JSON.stringify(n)}]=${n}`
    )
    .join(";");

  return [
    "(function(){",
    "window.__INVERT_SHARED__=window.__INVERT_SHARED__||{};",
    "var __ns__={};",
    code,
    ";",
    assignments,
    ";",
    `window.__INVERT_SHARED__[${JSON.stringify(moduleName)}]=__ns__;`,
    "})();",
  ].join("");
}

/**
 * Transforms `import ... from "shared/..."` statements in compiled JavaScript
 * to read from the `window.__INVERT_SHARED__` global registry instead.
 */
function resolveSharedImports(compiledJs: string): string {
  let code = compiledJs;

  // import { a, b } from "shared/name"
  code = code.replace(
    /^import\s*\{([^}]+)\}\s*from\s*["']shared\/([^"']+)["']\s*;?\s*$/gm,
    (_match, imports, modName) =>
      `const {${imports}} = window.__INVERT_SHARED__[${JSON.stringify(modName)}];`
  );

  // import name from "shared/name"  (default import)
  code = code.replace(
    /^import\s+(\w+)\s+from\s*["']shared\/([^"']+)["']\s*;?\s*$/gm,
    (_match, importName, modName) =>
      `const ${importName} = window.__INVERT_SHARED__[${JSON.stringify(modName)}]["default"];`
  );

  // import * as name from "shared/name"
  code = code.replace(
    /^import\s*\*\s*as\s+(\w+)\s+from\s*["']shared\/([^"']+)["']\s*;?\s*$/gm,
    (_match, importName, modName) =>
      `const ${importName} = window.__INVERT_SHARED__[${JSON.stringify(modName)}];`
  );

  return code;
}

export async function injectMatchingScripts(
  tabId: number,
  url: string,
  timing: "beforePageLoad" | "afterPageLoad"
): Promise<void> {
  try {
    const scriptsMap = await ChromeSyncStorage.getAllScripts();
    const compiledCodeMap = await CompiledCodeStorage.getAllCompiledCode();
    const allScripts: Userscript[] = Object.values(scriptsMap).map((script) => {
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
    });
    const enabledScripts = allScripts.filter((script) => script.enabled);

    // Collect all scripts that match this URL and timing
    const matchingScripts = enabledScripts.filter(
      (script) =>
        script.runAt === timing && matchesUrlPattern(url, script.urlPatterns)
    );

    if (matchingScripts.length === 0) {
      return;
    }

    // Phase 1: Inject CDN modules (deduplicated across all matching scripts)
    const modulesMap = await ChromeSyncStorage.getAllModules();
    const injectedModules = new Set<string>();

    for (const script of matchingScripts) {
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

    // Phase 2: Inject shared script dependencies, then Phase 3: userscripts
    const injectedShared = new Set<string>();

    for (const script of matchingScripts) {
      if (script.sharedScripts?.length > 0) {
        for (const sharedId of script.sharedScripts) {
          if (!injectedShared.has(sharedId)) {
            const shared = allScripts.find(
              (s) => s.id === sharedId && s.shared
            );
            if (shared?.moduleName && shared?.code?.compiled?.javascript) {
              await injectSharedScript(tabId, shared);
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
    let jsCode = script.code?.compiled?.javascript ?? "";

    // Resolve shared module imports if this script uses any
    if (script.sharedScripts?.length > 0) {
      jsCode = resolveSharedImports(jsCode);
    }

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
    const wrappedCode = wrapSharedScriptForInjection(
      script.moduleName,
      script.code.compiled.javascript
    );

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
      args: [wrappedCode],
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
        return new Promise<void>((resolve, reject) => {
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
