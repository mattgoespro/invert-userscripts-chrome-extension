import { runPublicationEffect } from "../publication/effects";
import { executeUserScript } from "./user-scripts-executor";
import { resolveModuleGraph, affectedConsumers } from "@shared/modules/graph";
import type { ModuleManifest } from "@shared/modules/manifest";
import {
  isCompiledArtifactFresh,
  digestUserscriptCompileSources,
} from "@shared/compile-metadata";
import {
  GlobalModule,
  GlobalModules,
  Userscript,
  Userscripts,
} from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import { hydrateUserscriptWithCompiled } from "@shared/userscript-hydrate";
import {
  collectEnabledCdnModuleIds,
  selectMatchingScriptsForInjection,
} from "./injection-plan";
import { matchesUrlPattern } from "@shared/url-matching";
import { isInjectablePage } from "@shared/injection-eligibility";
import {
  clearCssBookmark,
  clearCssBookmarksForTab,
  getCssBookmark,
  setCssBookmark,
} from "./css-bookmarks";

const tabQueues = new Map<number, Promise<unknown>>();
const tabEpochs = new Map<number, number>();
interface PinnedDocument {
  documentId: string;
  url: string;
  epoch: number;
}
async function pinDocument(
  tabId: number,
  url?: string
): Promise<PinnedDocument> {
  const frame = await chrome.webNavigation.getFrame({ tabId, frameId: 0 });
  if (!frame?.documentId || (url && frame.url !== url)) {
    throw new Error("The target document changed before injection.");
  }
  return {
    documentId: frame.documentId,
    url: frame.url,
    epoch: tabEpochs.get(tabId) ?? 0,
  };
}
function inTab<T>(tabId: number, operation: () => Promise<T>): Promise<T> {
  const task = (tabQueues.get(tabId) ?? Promise.resolve())
    .catch(() => {})
    .then(operation);
  tabQueues.set(tabId, task);
  void task
    .finally(() => {
      if (tabQueues.get(tabId) === task) {
        tabQueues.delete(tabId);
      }
    })
    .catch(() => {});
  return task;
}
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
  injectImmediately = false,
  documentId?: string,
  awaitCompletion = false
): Promise<void> {
  await executeUserScript({
    tabId,
    code,
    injectImmediately,
    documentId,
    awaitCompletion,
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
  injectImmediately = false,
  pinned?: PinnedDocument
): Promise<InjectResolvedResult> {
  if (!scripts.length) {
    return { injectedCount: 0, failedCount: 0 };
  }
  pinned ??= await pinDocument(tabId);
  const document = pinned;
  const { scriptsMap, minifyCompiledOutput } = injectionState;
  const compiled = await CompiledCodeStorage.getAllCompiledCode();
  for (const [id, entry] of Object.entries(compiled)) {
    if (
      scriptsMap[id] &&
      entry.build?.sourceDigest &&
      entry.build.sourceDigest !==
        (await digestUserscriptCompileSources(scriptsMap[id]))
    ) {
      delete compiled[id];
    }
  }
  const manifests: Record<string, ModuleManifest> = {};
  for (const [id, entry] of Object.entries(compiled)) {
    if (entry.manifest) {
      manifests[id] = entry.manifest;
    }
  }
  let modules = injectionState.modulesMap;
  const completed = new Set<string>();
  const failed = new Set<string>();
  let injectedCount = 0;
  let failedCount = 0;
  const run = async (
    label: string,
    operation: () => Promise<void>
  ): Promise<boolean> => {
    if (failed.has(label)) {
      return false;
    }
    if (completed.has(label)) {
      return true;
    }
    try {
      await operation();
      completed.add(label);
      return true;
    } catch (error) {
      failed.add(label);
      console.error("Injection failed:", label, error);
      return false;
    }
  };
  for (const script of scripts.filter((item) => !item.shared)) {
    // Old cached entries are rebuildable; never execute a guessed dependency graph.
    const graph = resolveModuleGraph([script.id], scriptsMap, manifests);
    if (
      graph.errors.length ||
      graph.orderedIds.some(
        (id) =>
          !isCompiledArtifactFresh(
            scriptsMap[id],
            compiled[id],
            minifyCompiledOutput
          )
      )
    ) {
      console.warn(
        "Skipping stale/unresolved script:",
        script.name,
        graph.errors
      );
      continue;
    }
    const sources = graph.orderedIds.map((id) => scriptsMap[id]);
    if (sources.some((item) => item.globalModules.length)) {
      modules ??= await ChromeSyncStorage.getAllModules();
    }
    const assertCurrent = async (): Promise<void> => {
      const frame = await chrome.webNavigation.getFrame({ tabId, frameId: 0 });
      if (
        frame?.documentId !== document.documentId ||
        (tabEpochs.get(tabId) ?? 0) !== document.epoch
      ) {
        throw new Error("The target document changed.");
      }
      const current = await loadRuntimeInjectionState(true);
      if (
        !current.scriptsMap[script.id]?.enabled ||
        current.minifyCompiledOutput !== minifyCompiledOutput ||
        sources.some(
          (source) =>
            JSON.stringify(current.scriptsMap[source.id]) !==
            JSON.stringify(scriptsMap[source.id])
        ) ||
        collectEnabledCdnModuleIds(sources, modules ?? {}).some(
          (id) =>
            JSON.stringify(current.modulesMap?.[id]) !==
            JSON.stringify(modules?.[id])
        )
      ) {
        throw new Error(
          "The saved script or its dependencies changed before execution."
        );
      }
    };
    let ready = true;
    for (const moduleId of collectEnabledCdnModuleIds(sources, modules ?? {})) {
      if (
        !(await run("cdn:" + moduleId, async () => {
          await assertCurrent();
          await injectCdnModule(
            tabId,
            modules![moduleId],
            injectImmediately,
            document.documentId,
            assertCurrent
          );
        }))
      ) {
        ready = false;
      }
    }
    for (const id of graph.orderedIds.filter((id) => id !== script.id)) {
      if (!ready) {
        break;
      }
      ready = await run("shared:" + id, async () => {
        await assertCurrent();
        await injectSharedScript(
          tabId,
          hydrateUserscriptWithCompiled(scriptsMap[id], compiled[id]),
          injectImmediately,
          document.documentId,
          compiled[id]?.manifest?.awaitCompletion
        );
      });
    }
    if (!ready) {
      failedCount++;
      continue;
    }
    const hydrated = hydrateUserscriptWithCompiled(script, compiled[script.id]);
    if (
      await run("script:" + script.id, async () => {
        await assertCurrent();
        await injectScript(
          tabId,
          hydrated,
          injectImmediately,
          document.documentId,
          compiled[script.id]?.manifest?.awaitCompletion
        );
      })
    ) {
      injectedCount++;
    } else {
      failedCount++;
    }
    if (
      !(await run("css:" + script.id, async () => {
        await assertCurrent();
        await injectStylesheet(
          tabId,
          hydrated,
          document.documentId,
          assertCurrent
        );
      }))
    ) {
      failedCount++;
    }
  }
  return { injectedCount, failedCount };
}

export async function injectMatchingScripts(
  tabId: number,
  url: string,
  timing: "beforePageLoad" | "afterPageLoad",
  injectionState?: RuntimeInjectionState
): Promise<void> {
  if (!isInjectablePage(url)) {
    return;
  }
  try {
    const state = injectionState ?? (await loadRuntimeInjectionState());
    const matchingScripts = selectMatchingScriptsForInjection(
      state.scriptsMap,
      url,
      timing
    );
    if (matchingScripts.length === 0) {
      return;
    }
    const pinned = await pinDocument(tabId, url);

    const result = await runPublicationEffect(
      "navigation:" + pinned.documentId + ":" + timing,
      async () => {
        const injected = await inTab(tabId, () =>
          injectResolvedScripts(
            tabId,
            matchingScripts,
            state,
            timing === "beforePageLoad",
            pinned
          )
        );
        return {
          success: injected.failedCount === 0,
          appliedTabCount: injected.injectedCount > 0 ? 1 : 0,
          failedCount: injected.failedCount,
        };
      }
    );

    if (!result.success) {
      console.error(
        `Finished injecting into tab ${tabId} with failed step(s).`
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
  const entries = await CompiledCodeStorage.getAllCompiledCode();
  const manifests: Record<string, ModuleManifest> = {};
  for (const [id, entry] of Object.entries(entries)) {
    if (entry.manifest) {
      manifests[id] = entry.manifest;
    }
  }
  const affectedIds =
    scriptIds.length === 0
      ? Object.keys(scriptsMap)
      : affectedConsumers(scriptIds, scriptsMap, manifests);

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
    if (!tab.id || !tab.url || !isInjectablePage(tab.url)) {
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

      const pinned = await pinDocument(tab.id, tab.url);
      const [beforeResult, afterResult] = await inTab(tab.id, async () => {
        const beforeResult = await injectResolvedScripts(
          tab.id,
          before,
          injectionState,
          true,
          pinned
        );
        const afterResult = await injectResolvedScripts(
          tab.id,
          after,
          injectionState,
          false,
          pinned
        );
        return [beforeResult, afterResult];
      });

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

  if (!script || script.enabled) {
    return { removedTabCount: 0 };
  }

  const tabs = await chrome.tabs.query({});
  let removedTabCount = 0;

  for (const tab of tabs) {
    if (!tab.id || !tab.url || !isInjectablePage(tab.url)) {
      continue;
    }

    if (!matchesUrlPattern(tab.url, script.urlPatterns)) {
      continue;
    }

    await inTab(tab.id, async () => {
      const current = (await ChromeSyncStorage.getAllScripts())[scriptId];
      if (!current || current.enabled) {
        return;
      }
      const pinned = await pinDocument(tab.id!, tab.url);
      await removeInjectedStylesheet(tab.id!, scriptId, pinned.documentId);
      removedTabCount++;
    });
  }

  return { removedTabCount };
}

export async function prepareTabForInjection(tabId: number): Promise<void> {
  tabEpochs.set(tabId, (tabEpochs.get(tabId) ?? 0) + 1);
  await clearCssBookmarksForTab(tabId);
}

export async function injectScript(
  tabId: number,
  script: Userscript,
  injectImmediately = false,
  documentId?: string,
  awaitCompletion = false
): Promise<void> {
  const jsCode = script.code?.compiled?.javascript ?? "";

  if (!jsCode.trim()) {
    return;
  }

  await executeInlineMainWorldScript(
    tabId,
    jsCode,
    injectImmediately,
    documentId,
    awaitCompletion
  );
  console.log(`Injected script: ${script.name} into tab ${tabId}`);
}

async function injectSharedScript(
  tabId: number,
  script: Userscript,
  injectImmediately = false,
  documentId?: string,
  awaitCompletion = false
): Promise<void> {
  await executeInlineMainWorldScript(
    tabId,
    script.code.compiled.javascript,
    injectImmediately,
    documentId,
    awaitCompletion
  );
  console.log(`Injected shared script: ${script.name} into tab ${tabId}`);
}

/**
 * Fetch CDN source with extension host permissions, then execute it through
 * the permission-gated userScripts API in the originating MAIN document.
 */
async function injectCdnModule(
  tabId: number,
  module: GlobalModule,
  injectImmediately = false,
  documentId?: string,
  assertCurrent?: () => Promise<void>
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
  await assertCurrent?.();
  await executeInlineMainWorldScript(
    tabId,
    source,
    injectImmediately,
    documentId
  );
  console.log(`Injected CDN module: ${module.name} into tab ${tabId}`);
}

async function removeInjectedStylesheet(
  tabId: number,
  scriptId: string,
  documentId?: string
): Promise<void> {
  const previousCss = await getCssBookmark(tabId, scriptId);

  if (!previousCss) {
    return;
  }

  try {
    await chrome.scripting.removeCSS({
      target: { tabId, ...(documentId ? { documentIds: [documentId] } : {}) },
      css: previousCss,
    });
  } catch (error) {
    const frame = documentId
      ? await chrome.webNavigation
          .getFrame({ tabId, frameId: 0 })
          .catch((): null => null)
      : null;
    const replaced = Boolean(
      frame?.documentId && frame.documentId !== documentId
    );
    const closed =
      error instanceof Error &&
      /No tab with id|Invalid tab ID/i.test(error.message);
    if (!replaced && !closed) {
      throw error;
    }
  }

  await clearCssBookmark(tabId, scriptId);
}

/**
 * Injects compiled CSS with replace semantics: previous insertion for this
 * tab/script is removed first (when known). Identical re-apply is a no-op.
 */
async function injectStylesheet(
  tabId: number,
  script: Userscript,
  documentId?: string,
  assertCurrent?: () => Promise<void>
): Promise<void> {
  const cssCode = script.code?.compiled?.css ?? "";
  const previousCss = await getCssBookmark(tabId, script.id);

  if (previousCss && previousCss === cssCode) {
    return;
  }

  if (previousCss) {
    await removeInjectedStylesheet(tabId, script.id, documentId);
  }

  if (!cssCode) {
    return;
  }

  await assertCurrent?.();
  await chrome.scripting.insertCSS({
    target: { tabId, ...(documentId ? { documentIds: [documentId] } : {}) },
    css: cssCode,
  });
  await setCssBookmark(tabId, script.id, cssCode);
  console.log(`Injected stylesheet: ${script.name} into tab ${tabId}`);
}

/** Retryable stylesheet reconciliation deliberately executes no JavaScript. */
export async function reconcileStylesForScripts(ids: string[]): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const failures: unknown[] = [];
  for (const tab of tabs) {
    if (!tab.id || !tab.url || !/^(?:https?|file):/.test(tab.url)) {
      continue;
    }
    try {
      await inTab(tab.id, async () => {
        for (const id of ids) {
          const state = await loadRuntimeInjectionState();
          const source = state.scriptsMap[id];
          const artifact = await CompiledCodeStorage.getCompiledCode(id);
          const desired = Boolean(
            source?.enabled &&
            !source.shared &&
            matchesUrlPattern(tab.url!, source.urlPatterns) &&
            isCompiledArtifactFresh(
              source,
              artifact,
              state.minifyCompiledOutput
            ) &&
            (!artifact.build?.sourceDigest ||
              artifact.build.sourceDigest ===
                (await digestUserscriptCompileSources(source)))
          );
          if (!desired && !(await getCssBookmark(tab.id!, id))) {
            continue;
          }
          const pinned = await pinDocument(tab.id!, tab.url);
          if (desired) {
            await injectStylesheet(
              tab.id!,
              hydrateUserscriptWithCompiled(source, artifact!),
              pinned.documentId,
              async () => {
                const current = (await ChromeSyncStorage.getAllScripts())[id];
                if (JSON.stringify(current) !== JSON.stringify(source)) {
                  throw new Error(
                    "Stylesheet intent changed during reconciliation."
                  );
                }
              }
            );
          } else {
            await removeInjectedStylesheet(tab.id!, id, pinned.documentId);
          }
        }
      });
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) {
    throw new Error(
      "Stylesheet reconciliation has pending target failures: " +
        failures
          .map((error) =>
            error instanceof Error ? error.message : String(error)
          )
          .join("; ")
    );
  }
}
