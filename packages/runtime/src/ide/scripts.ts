import { expandAffectedScriptIds } from "@shared/apply-scope";
import { isCompiledArtifactFresh } from "@shared/compile-metadata";
import {
  GlobalModule,
  GlobalModules,
  Userscript,
  Userscripts,
} from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import { hydrateUserscriptWithCompiled } from "@shared/userscript-hydrate";
import {
  collectCompiledCodeScriptIds,
  collectEnabledCdnModuleIds,
  collectSharedScriptIdsToInject,
  selectMatchingScriptsForInjection,
  sharedDependenciesAreFresh,
} from "./injection-plan";
import {
  runIsolatedInjectTasks,
  shouldAwaitInjectedEvalResult,
  type IsolatedInjectTask,
} from "./inject-helpers";
import { matchesUrlPattern } from "@shared/url-matching";
import {
  clearCssBookmark,
  clearCssBookmarksForTab,
  getCssBookmark,
  setCssBookmark,
} from "./css-bookmarks";

export interface RuntimeInjectionState {
  scriptsMap: Userscripts;
  modulesMap?: GlobalModules;
  minifyCompiledOutput: boolean;
}

export async function loadRuntimeInjectionState(
  includeModules = false
): Promise<RuntimeInjectionState> {
  const [scriptsMap, modulesMap, editorSettings] = await Promise.all([
    ChromeSyncStorage.getAllScripts(),
    includeModules
      ? ChromeSyncStorage.getAllModules()
      : Promise.resolve(undefined),
    ChromeSyncStorage.getEditorSettings(),
  ]);

  return {
    scriptsMap,
    modulesMap,
    minifyCompiledOutput: editorSettings.minifyCompiledOutput ?? false,
  };
}

async function executeInlineMainWorldScript(
  tabId: number,
  code: string,
  injectImmediately = false
): Promise<void> {
  if (!code.trim()) {
    return;
  }

  const awaitCompletion = shouldAwaitInjectedEvalResult(code);

  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    injectImmediately,
    func: async (payload: string, awaitResult: boolean) => {
      // Indirect eval runs in the page global scope. The function is injected
      // by chrome.scripting, so it is not subject to the page's CSP (unlike a
      // page-created <script> element).
      const result: unknown = (0, eval)(payload);

      if (
        awaitResult &&
        result !== null &&
        result !== undefined &&
        typeof result === "object" &&
        "then" in result &&
        typeof result.then === "function"
      ) {
        await result;
      }
    },
    args: [code, awaitCompletion],
  });
}

export type InjectResolvedResult = {
  injectedCount: number;
  failedCount: number;
};

/**
 * Inject a specific set of already-filtered scripts into a tab (CDN → shared →
 * JS → CSS). Callers own URL/enabled/runAt filtering. One failed step does
 * not abort siblings.
 */
async function injectResolvedScripts(
  tabId: number,
  scripts: Userscript[],
  injectionState: RuntimeInjectionState,
  injectImmediately = false
): Promise<InjectResolvedResult> {
  if (scripts.length === 0) {
    return { injectedCount: 0, failedCount: 0 };
  }

  const { scriptsMap, minifyCompiledOutput } = injectionState;
  const compiledCodeMap = await CompiledCodeStorage.getCompiledCodeForScripts(
    collectCompiledCodeScriptIds(scripts, scriptsMap)
  );

  const resolvedScripts = scripts.filter((script) => {
    const entry = compiledCodeMap[script.id];

    if (
      !isCompiledArtifactFresh(script, entry, minifyCompiledOutput) ||
      !sharedDependenciesAreFresh(
        script,
        scriptsMap,
        compiledCodeMap,
        minifyCompiledOutput
      )
    ) {
      console.warn(
        `Skipping "${script.name}" until compiled output and shared modules are current.`
      );
      return false;
    }

    return true;
  });

  if (resolvedScripts.length === 0) {
    return { injectedCount: 0, failedCount: 0 };
  }

  const pageScripts = resolvedScripts.filter((script) => !script.shared);
  const sharedIds = collectSharedScriptIdsToInject(pageScripts, scriptsMap);
  const sharedScripts = sharedIds
    .map((sharedId) => scriptsMap[sharedId])
    .filter((script): script is Userscript => Boolean(script));

  let modulesMap = injectionState.modulesMap;
  const tasks: IsolatedInjectTask[] = [];
  const cdnSources = [...pageScripts, ...sharedScripts];

  if (cdnSources.some((script) => script.globalModules?.length > 0)) {
    modulesMap = modulesMap ?? (await ChromeSyncStorage.getAllModules());

    for (const moduleId of collectEnabledCdnModuleIds(cdnSources, modulesMap)) {
      const module = modulesMap[moduleId];

      if (module) {
        tasks.push({
          label: `cdn:${module.name}`,
          run: () => injectCdnModule(tabId, module, injectImmediately),
        });
      }
    }
  }

  for (const sharedId of sharedIds) {
    const shared = scriptsMap[sharedId];
    const sharedEntry = compiledCodeMap[sharedId];

    if (!shared || !sharedEntry) {
      continue;
    }

    tasks.push({
      label: `shared:${shared.name}`,
      run: () =>
        injectSharedScript(
          tabId,
          hydrateUserscriptWithCompiled(shared, sharedEntry),
          injectImmediately
        ),
    });
  }

  for (const script of pageScripts) {
    tasks.push({
      label: `userscript:${script.name}`,
      run: () =>
        injectScript(
          tabId,
          hydrateUserscriptWithCompiled(script, compiledCodeMap[script.id]),
          injectImmediately
        ),
    });
  }

  for (const script of pageScripts) {
    tasks.push({
      label: `css:${script.name}`,
      run: () =>
        injectStylesheet(
          tabId,
          hydrateUserscriptWithCompiled(script, compiledCodeMap[script.id])
        ),
    });
  }

  const { succeeded, failed } = await runIsolatedInjectTasks(tasks);

  return {
    injectedCount: succeeded,
    failedCount: failed.length,
  };
}

export async function injectMatchingScripts(
  tabId: number,
  url: string,
  timing: "beforePageLoad" | "afterPageLoad",
  injectionState?: RuntimeInjectionState
): Promise<void> {
  try {
    const state = injectionState ?? (await loadRuntimeInjectionState());
    const matchingScripts = selectMatchingScriptsForInjection(
      state.scriptsMap,
      url,
      timing
    );

    const result = await injectResolvedScripts(
      tabId,
      matchingScripts,
      state,
      timing === "beforePageLoad"
    );

    if (result.failedCount > 0) {
      console.error(
        `Finished injecting into tab ${tabId} with ${result.failedCount} failed step(s).`
      );
    }
  } catch (error) {
    console.error("Error injecting scripts: ", error);
  }
}

/**
 * Re-apply the given scripts to open tabs whose URL matches. Empty `scriptIds`
 * means every script. Shared-module consumers are included automatically.
 * Unrelated tabs are not touched.
 */
export async function applyScriptsToMatchingTabs(scriptIds: string[]): Promise<{
  appliedTabCount: number;
  success: boolean;
  staleSkipCount: number;
}> {
  const injectionState = await loadRuntimeInjectionState(true);
  const { scriptsMap } = injectionState;

  const affectedIds =
    scriptIds.length === 0
      ? Object.keys(scriptsMap)
      : expandAffectedScriptIds(scriptIds, scriptsMap);

  const affectedScripts = affectedIds
    .map((id) => scriptsMap[id])
    .filter((script): script is Userscript =>
      Boolean(script?.enabled && !script.shared)
    );

  if (affectedScripts.length === 0) {
    return { appliedTabCount: 0, success: true, staleSkipCount: 0 };
  }

  const tabs = await chrome.tabs.query({});
  let appliedTabCount = 0;
  let failedTabCount = 0;
  let staleSkipCount = 0;

  for (const tab of tabs) {
    if (!tab.id || !tab.url) {
      continue;
    }

    const matchingForTab = affectedScripts.filter((script) =>
      matchesUrlPattern(tab.url!, script.urlPatterns)
    );

    if (matchingForTab.length === 0) {
      continue;
    }

    try {
      const before = matchingForTab.filter(
        (script) => script.runAt === "beforePageLoad"
      );
      const after = matchingForTab.filter(
        (script) => script.runAt === "afterPageLoad"
      );

      const beforeResult = await injectResolvedScripts(
        tab.id,
        before,
        injectionState,
        true
      );
      const afterResult = await injectResolvedScripts(
        tab.id,
        after,
        injectionState,
        false
      );

      const injectedCount =
        beforeResult.injectedCount + afterResult.injectedCount;
      const failedCount = beforeResult.failedCount + afterResult.failedCount;

      if (failedCount > 0) {
        failedTabCount += 1;
      }

      if (injectedCount > 0) {
        appliedTabCount += 1;
      } else if (failedCount === 0) {
        staleSkipCount += 1;
      }
    } catch (error) {
      failedTabCount += 1;
      console.error(`Error applying scripts to tab ${tab.id}:`, error);
    }
  }

  return {
    appliedTabCount,
    success: failedTabCount === 0,
    staleSkipCount,
  };
}

/**
 * Best-effort teardown for a disabled script: remove tracked CSS from matching
 * open tabs. MAIN-world JS side effects are not undone without a reload.
 */
export async function removeScriptFromMatchingTabs(
  scriptId: string
): Promise<{ removedTabCount: number }> {
  const scriptsMap = await ChromeSyncStorage.getAllScripts();
  const script = scriptsMap[scriptId];

  if (!script) {
    return { removedTabCount: 0 };
  }

  const tabs = await chrome.tabs.query({});
  let removedTabCount = 0;

  for (const tab of tabs) {
    if (!tab.id || !tab.url) {
      continue;
    }

    if (!matchesUrlPattern(tab.url, script.urlPatterns)) {
      continue;
    }

    await removeInjectedStylesheet(tab.id, scriptId);
    removedTabCount += 1;
  }

  return { removedTabCount };
}

export async function prepareTabForInjection(tabId: number): Promise<void> {
  await clearCssBookmarksForTab(tabId);
}

export async function injectScript(
  tabId: number,
  script: Userscript,
  injectImmediately = false
): Promise<void> {
  const jsCode = script.code?.compiled?.javascript ?? "";

  if (!jsCode.trim()) {
    return;
  }

  await executeInlineMainWorldScript(tabId, jsCode, injectImmediately);
  console.log(`Injected script: ${script.name} into tab ${tabId}`);
}

async function injectSharedScript(
  tabId: number,
  script: Userscript,
  injectImmediately = false
): Promise<void> {
  await executeInlineMainWorldScript(
    tabId,
    script.code.compiled.javascript,
    injectImmediately
  );
  console.log(`Injected shared script: ${script.name} into tab ${tabId}`);
}

/**
 * Fetch CDN source with extension host permissions, then evaluate it in the
 * page MAIN world so page CSP cannot block a `<script src>`.
 */
async function injectCdnModule(
  tabId: number,
  module: GlobalModule,
  injectImmediately = false
): Promise<void> {
  const response = await fetch(module.url, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch CDN module ${module.url}: ${response.status}`
    );
  }

  const source = await response.text();
  await executeInlineMainWorldScript(tabId, source, injectImmediately);
  console.log(`Injected CDN module: ${module.name} into tab ${tabId}`);
}

async function removeInjectedStylesheet(
  tabId: number,
  scriptId: string
): Promise<void> {
  const previousCss = await getCssBookmark(tabId, scriptId);

  if (!previousCss) {
    return;
  }

  try {
    await chrome.scripting.removeCSS({
      target: { tabId },
      css: previousCss,
    });
  } catch (error) {
    console.warn(
      `Failed to remove stylesheet for script ${scriptId} from tab ${tabId}:`,
      error
    );
  }

  await clearCssBookmark(tabId, scriptId);
}

/**
 * Injects compiled CSS with replace semantics: previous insertion for this
 * tab/script is removed first (when known). Identical re-apply is a no-op.
 */
async function injectStylesheet(
  tabId: number,
  script: Userscript
): Promise<void> {
  const cssCode = script.code?.compiled?.css ?? "";
  const previousCss = await getCssBookmark(tabId, script.id);

  if (previousCss && previousCss === cssCode) {
    return;
  }

  if (previousCss) {
    try {
      await chrome.scripting.removeCSS({
        target: { tabId },
        css: previousCss,
      });
    } catch (error) {
      console.warn(
        `Failed to remove previous stylesheet for ${script.name}:`,
        error
      );
    }
    await clearCssBookmark(tabId, script.id);
  }

  if (!cssCode) {
    return;
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    css: cssCode,
  });
  await setCssBookmark(tabId, script.id, cssCode);
  console.log(`Injected stylesheet: ${script.name} into tab ${tabId}`);
}
