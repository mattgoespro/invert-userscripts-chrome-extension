import {
  analyzeTypeDeclarations,
  analyzeUserscriptModule,
} from "@/sandbox/compiler";
import type { ModuleManifest } from "@shared/modules/manifest";
import {
  buildScriptFileUri,
  ensureTypescriptDefaults,
  registerModuleSpecifierCompletion,
  type SharedModuleSpecifierInfo,
  type WorkspaceFile,
  reconcileLanguageWorkspace,
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
 * - Static package.json extra libs and owner-local declaration augmentations.
 *   Adding exports to a pane enables external imports without removing its
 *   implicit names from the owning main module.
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
    shared: script.shared,
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
  const manifests: Record<string, ModuleManifest> = {};
  const pendingAnalysis = new Map<string, string>();
  const declarations: Record<string, { source: string; contents: string }> = {};
  const pendingDeclarations = new Map<string, string>();
  let analysisTimer: ReturnType<typeof setTimeout> | undefined;
  const analyze = () => {
    const state = store.getState();
    for (const script of Object.values(state.userscripts.scripts ?? {})) {
      const types =
        state.editorDrafts.drafts[script.id]?.typeDefinitions ??
        script.typeDefinitions ??
        "";
      if (
        declarations[script.id]?.source !== types &&
        pendingDeclarations.get(script.id) !== types
      ) {
        pendingDeclarations.set(script.id, types);
        void analyzeTypeDeclarations(types).then(
          (contents) => {
            if (!running || pendingDeclarations.get(script.id) !== types) {
              return;
            }
            pendingDeclarations.delete(script.id);
            declarations[script.id] = { source: types, contents };
            sync();
          },
          (error) => {
            if (pendingDeclarations.get(script.id) === types) {
              pendingDeclarations.delete(script.id);
            }
            console.warn("Declaration analysis failed:", error);
          }
        );
      }
      const source =
        state.editorDrafts.drafts[script.id]?.typescript ??
        script.code.source.typescript;
      if (
        manifests[script.id]?.source === source ||
        pendingAnalysis.get(script.id) === source
      ) {
        continue;
      }
      pendingAnalysis.set(script.id, source);
      void analyzeUserscriptModule(source).then(
        (manifest) => {
          if (!running || pendingAnalysis.get(script.id) !== source) {
            return;
          }
          pendingAnalysis.delete(script.id);
          manifests[script.id] = manifest;
          sync();
        },
        (error) => {
          if (pendingAnalysis.get(script.id) === source) {
            pendingAnalysis.delete(script.id);
          }
          console.warn("Module analysis failed:", error);
        }
      );
    }
    for (const id of Object.keys(manifests)) {
      if (!state.userscripts.scripts[id]) {
        delete manifests[id];
        pendingAnalysis.delete(id);
      }
    }
    for (const id of Object.keys(declarations)) {
      if (!state.userscripts.scripts[id]) {
        delete declarations[id];
        pendingDeclarations.delete(id);
      }
    }
  };
  let lastState = store.getState();

  const sync = () => {
    scheduled = null;

    const state = store.getState();
    const projection = projectWorkspace(
      {
        scripts: state.userscripts.scripts ?? {},
        drafts: state.editorDrafts.drafts,
        currentScriptId: state.userscripts.currentScriptId,
        modules: state.modules.modules ?? {},
        manifests,
        declarations,
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
    reconcileLanguageWorkspace({
      files,
      typeDefinitionLibs: projection.typeDefinitionLibs,
      modulePaths: projection.modulePaths,
      cdnModules: projection.cdnModules,
      aliases: Object.values(state.userscripts.scripts ?? {}).map((script) => ({
        id: script.id,
        modulePath: getScriptModulePath(script),
      })),
    });
  };

  const unsubscribe = store.subscribe(() => {
    const nextState = store.getState();
    const previousState = lastState;
    lastState = nextState;
    if (
      nextState.userscripts.scripts === previousState.userscripts.scripts &&
      nextState.userscripts.currentScriptId ===
        previousState.userscripts.currentScriptId &&
      nextState.editorDrafts.drafts === previousState.editorDrafts.drafts &&
      nextState.modules.modules === previousState.modules.modules
    ) {
      return;
    }

    if (
      nextState.userscripts.currentScriptId !==
      previousState.userscripts.currentScriptId
    ) {
      if (scheduled != null) {
        clearTimeout(scheduled);
        scheduled = null;
      }

      sync();
      return;
    }

    scheduled ??= setTimeout(sync, SYNC_DEBOUNCE_MS);
    clearTimeout(analysisTimer);
    analysisTimer = setTimeout(analyze, 150);
  });

  sync();
  analyze();

  return () => {
    unsubscribe();
    clearTimeout(analysisTimer);
    pendingAnalysis.clear();
    pendingDeclarations.clear();

    if (scheduled != null) {
      clearTimeout(scheduled);
    }

    completionDisposable.dispose();
    codeActionsDisposable.dispose();
    running = false;
  };
}
