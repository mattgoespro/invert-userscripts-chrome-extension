import { Userscript } from "../../../shared/src/model";
import { ChromeSyncStorage } from "@shared/storage";

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
  url: string
): Promise<void> {
  try {
    const scriptsMap = await ChromeSyncStorage.getAllScripts();
    const allScripts: Userscript[] = Object.values(scriptsMap);
    const enabledScripts = allScripts.filter((script) => script.enabled);
    const injectedShared = new Set<string>();

    for (const script of enabledScripts) {
      if (matchesUrlPattern(url, script.urlPatterns)) {
        // Inject shared script dependencies before the consumer
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
      }
    }
  } catch (error) {
    console.error("Error injecting scripts: ", error);
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
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape regex special chars including backslash
      .replace(/\*/g, ".*") // Convert * to .*
      .replace(/\?/g, "."); // Convert ? to .

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  });
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
