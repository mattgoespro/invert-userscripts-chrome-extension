import {
  buildScriptFileUri,
  ensureTypescriptDefaults,
  refreshTypescriptDiagnosticsIfProgramFilesChanged,
  registerModuleSpecifierCompletion,
  syncAmbientTypeDefinitionLibs,
  syncCdnModuleLibs,
  syncModulePackageJsons,
  syncWorkspaceModels,
  type SharedModuleSpecifierInfo,
  type WorkspaceFile,
} from "@packages/monaco";
import { getScriptModulePath } from "@shared/model";
import type { AppStore, RootState } from "../store/store";
import { registerBespokeCodeActions } from "../utils/quick-fix-provider";
import { projectWorkspace } from "./workspace-sync-plan";

/**
 * The single owner of all store -> Monaco synchronization.
 *
 * Subscribes to the Redux store exactly once and reconciles, debounced and
 * revision-diffed:
 *
 * - Monaco models for every userscript `main.ts` (auto-import needs exported
 *   symbols before any `scripts/<m>/main` import exists). The active types
 *   pane is always mounted; offscreen types panes are mounted only when they
 *   are modules (`import`/`export`), so adding or removing `export` remounts
 *   them on the next draft sync.
 * - Static package.json extra libs for every script. Type panes are never
 *   extra-libbed: unexported names are own-script ambient globals; exported
 *   names are import-only via `scripts/<m>/types`.
 * - CDN `@types` only for modules referenced by the active closure and dirty
 *   drafts.
 *
 * Editors own attached buffers. The service only overwrites an attached buffer
 * when that buffer's draft is clean (e.g. storage-sync take-remote).
 */

const SYNC_DEBOUNCE_MS = 50;

function selectModuleInfos(state: RootState): SharedModuleSpecifierInfo[] {
  return Object.values(state.userscripts.scripts ?? {}).map((script) => ({
    moduleName: getScriptModulePath(script),
    scriptName: script.name,
  }));
}

let running = false;

export function startWorkspaceService(store: AppStore): () => void {
  if (running) {
    return () => {};
  }

  running = true;
  ensureTypescriptDefaults();

  const completionDisposable = registerModuleSpecifierCompletion(() =>
    selectModuleInfos(store.getState())
  );
  const codeActionsDisposable = registerBespokeCodeActions();

  let scheduled: ReturnType<typeof setTimeout> | null = null;
  let lastSignature = "";
  let lastCurrentScriptId =
    store.getState().userscripts.currentScriptId ?? null;

  const sync = () => {
    scheduled = null;

    const state = store.getState();
    const projection = projectWorkspace(
      {
        scripts: state.userscripts.scripts ?? {},
        drafts: state.editorDrafts.drafts,
        currentScriptId: state.userscripts.currentScriptId,
        modules: state.modules.modules ?? {},
      },
      lastSignature
    );

    if (!projection) {
      return;
    }

    lastSignature = projection.signature;
    const files: WorkspaceFile[] = projection.models.map(
      ({ script, editor, ...file }) => ({
        ...file,
        uri: buildScriptFileUri(script, editor),
      })
    );
    syncModulePackageJsons(projection.modulePaths);
    syncWorkspaceModels(files);
    refreshTypescriptDiagnosticsIfProgramFilesChanged(
      files
        .filter((file) => file.language === "typescript")
        .map((file) => file.uri)
    );
    // Clear ambient copies left by older sessions; type panes are real models.
    syncAmbientTypeDefinitionLibs([]);

    void syncCdnModuleLibs(projection.cdnModules).catch((error) => {
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
