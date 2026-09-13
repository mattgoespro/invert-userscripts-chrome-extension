import {
  buildScriptFileUri,
  ensureTypescriptDefaults,
  registerModuleSpecifierCompletion,
  syncAmbientTypeDefinitionLibs,
  syncCdnModuleLibs,
  syncModulePackageJsons,
  syncWorkspaceModels,
  type SharedModuleSpecifierInfo,
  type WorkspaceFile,
} from "@packages/monaco";
import { getScriptModulePath, type Userscript } from "@shared/model";
import {
  listImportedSharedScriptIds,
  resolveWorkspaceScriptClosure,
} from "@shared/workspace-closure";
import { isDraftDirty } from "../store/slices/editor-drafts";
import type { AppStore, RootState } from "../store/store";
import { registerBespokeCodeActions } from "../utils/quick-fix-provider";
import {
  isModuleDeclarationFile,
  stripExportsForAmbientLib,
} from "./ambient-type-defs";
import { getDraftBuffer } from "./workspace-sync-plan";

/**
 * The single owner of all store -> Monaco synchronization.
 *
 * Subscribes to the Redux store exactly once and reconciles, debounced and
 * revision-diffed:
 *
 * - Monaco models for the active script, its import closure, dirty offscreen
 *   drafts, and shared modules imported by any script (kept resident so
 *   switching away from a consumer does not dispose its dependencies).
 *   Unrelated unused shared modules stay out of the TypeScript program.
 * - Static package.json extra libs and ambient type copies for the active
 *   closure (not for resident imports that are out of scope).
 * - CDN `@types` only for modules referenced by the active closure and dirty
 *   drafts.
 *
 * Editors own attached buffers. The service only overwrites an attached buffer
 * when that buffer's draft is clean (e.g. storage-sync take-remote).
 */

const SYNC_DEBOUNCE_MS = 50;

function selectSharedModuleInfos(
  state: RootState
): SharedModuleSpecifierInfo[] {
  return Object.values(state.userscripts.scripts ?? {})
    .filter((script) => script.shared)
    .map((script) => ({
      moduleName: getScriptModulePath(script),
      scriptName: script.name,
    }));
}

function selectCurrentScript(state: RootState) {
  const currentScriptId = state.userscripts.currentScriptId;
  return currentScriptId
    ? (state.userscripts.scripts?.[currentScriptId] ?? undefined)
    : undefined;
}

let running = false;

export function startWorkspaceService(store: AppStore): () => void {
  if (running) {
    return () => {};
  }

  running = true;
  ensureTypescriptDefaults();

  const completionDisposable = registerModuleSpecifierCompletion(() =>
    selectSharedModuleInfos(store.getState())
  );
  const codeActionsDisposable = registerBespokeCodeActions();

  let scheduled: ReturnType<typeof setTimeout> | null = null;
  let lastSignature = "";
  let lastCurrentScriptId =
    store.getState().userscripts.currentScriptId ?? null;

  const sync = () => {
    scheduled = null;

    const state = store.getState();
    const scriptsMap = state.userscripts.scripts ?? {};
    const scripts = Object.values(scriptsMap);
    const drafts = state.editorDrafts.drafts;
    const currentScript = selectCurrentScript(state);
    const modules = state.modules.modules ?? {};

    const getTypescriptSource = (script: Userscript) =>
      getDraftBuffer(script, drafts[script.id], "typescript").contents;

    const closureIds = resolveWorkspaceScriptClosure(
      currentScript,
      scriptsMap,
      { getTypescriptSource }
    );
    const dirtyDraftIds = Object.entries(drafts)
      .filter(([, draft]) => isDraftDirty(draft))
      .map(([scriptId]) => scriptId)
      .filter((scriptId) => scriptsMap[scriptId] != null);
    const importedSharedIds = listImportedSharedScriptIds(
      scriptsMap,
      getTypescriptSource
    );

    const closureDeps = closureIds.filter(
      (scriptId) => scriptId !== currentScript?.id
    );
    const included = new Set(closureDeps);
    const workspaceIds = [...closureDeps];

    if (currentScript) {
      workspaceIds.push(currentScript.id);
      included.add(currentScript.id);
    }

    for (const scriptId of [...dirtyDraftIds, ...importedSharedIds]) {
      if (!included.has(scriptId)) {
        workspaceIds.push(scriptId);
        included.add(scriptId);
      }
    }

    const typeScopeIds = new Set([
      ...closureIds,
      ...(currentScript ? [currentScript.id] : []),
      ...dirtyDraftIds,
    ]);

    // Signature tracks draft revision + TypeScript text (import edges), not
    // the persisted sharedScripts cache.
    const signature = JSON.stringify([
      workspaceIds.map((scriptId) => {
        const script = scriptsMap[scriptId];
        const typescript = script
          ? getDraftBuffer(script, drafts[scriptId], "typescript").contents
          : "";

        return [
          scriptId,
          script ? getScriptModulePath(script) : "",
          script?.updatedAt ?? 0,
          drafts[scriptId]?.revision ?? -1,
          typescript,
        ];
      }),
      currentScript?.id,
      Object.values(modules).map((module) => [module.id, module.packageName]),
    ]);

    if (signature === lastSignature) {
      return;
    }

    lastSignature = signature;

    const files: WorkspaceFile[] = [];
    const ambientLibs: Array<{
      id: string;
      filePath: string;
      contents: string;
    }> = [];

    for (const scriptId of workspaceIds) {
      const script = scriptsMap[scriptId];

      if (!script) {
        continue;
      }

      const isActive = script.id === currentScript?.id;
      const draft = drafts[script.id];
      const main = getDraftBuffer(script, draft, "typescript");
      const types = getDraftBuffer(script, draft, "typeDefinitions");

      files.push({
        uri: buildScriptFileUri(script, "main"),
        language: "typescript",
        contents: main.contents,
        preserveAttachedBuffer: main.dirty,
      });

      if (isActive || typeScopeIds.has(script.id)) {
        files.push({
          uri: buildScriptFileUri(script, "types"),
          language: "typescript",
          contents: types.contents,
          preserveAttachedBuffer: types.dirty,
        });
      }

      if (isActive || isDraftDirty(draft)) {
        const styles = getDraftBuffer(script, draft, "scss");
        files.push({
          uri: buildScriptFileUri(script, "styles"),
          language: "scss",
          contents: styles.contents,
          preserveAttachedBuffer: styles.dirty,
        });
      }

      if (
        !isActive &&
        typeScopeIds.has(script.id) &&
        script.shared &&
        isModuleDeclarationFile(types.contents)
      ) {
        const ambientContents = stripExportsForAmbientLib(types.contents);

        if (ambientContents.trim()) {
          const modulePath = getScriptModulePath(script);
          ambientLibs.push({
            id: `ambient:${script.id}`,
            filePath: `file:///scripts/${modulePath}/types.ambient.d.ts`,
            contents: ambientContents,
          });
        }
      }
    }

    const modulePaths = scripts.map((script) => getScriptModulePath(script));
    syncModulePackageJsons(modulePaths);
    syncWorkspaceModels(files);
    syncAmbientTypeDefinitionLibs(ambientLibs);

    // Register @types only for CDN modules referenced by the active script,
    // its import closure, and dirty drafts so unrelated package globals do not
    // leak into the editor via resident imported modules.
    const referencedModuleIds = new Set<string>();

    for (const scriptId of typeScopeIds) {
      for (const moduleId of scriptsMap[scriptId]?.globalModules ?? []) {
        referencedModuleIds.add(moduleId);
      }
    }

    const cdnModules = Object.values(modules).flatMap((module) =>
      referencedModuleIds.has(module.id) && module.packageName
        ? [{ id: module.id, packageName: module.packageName }]
        : []
    );

    void syncCdnModuleLibs(cdnModules).catch((error) => {
      console.warn("CDN type acquisition failed:", error);
    });
  };

  const unsubscribe = store.subscribe(() => {
    const nextId = store.getState().userscripts.currentScriptId ?? null;

    if (nextId !== lastCurrentScriptId) {
      lastCurrentScriptId = nextId;

      if (scheduled != null) {
        clearTimeout(scheduled);
        scheduled = null;
      }

      sync();
      return;
    }

    scheduled ??= setTimeout(sync, SYNC_DEBOUNCE_MS);
  });

  sync();

  return () => {
    unsubscribe();

    if (scheduled != null) {
      clearTimeout(scheduled);
    }

    completionDisposable.dispose();
    codeActionsDisposable.dispose();
    running = false;
  };
}
