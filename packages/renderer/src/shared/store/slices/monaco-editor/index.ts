import {
  addSharedScriptExtraLib,
  ensureTypescriptDefaults,
  generateSharedScriptDeclaration,
} from "@packages/monaco";
import { createSelector, createSlice } from "@reduxjs/toolkit";
import { SharedScriptInfo } from "@shared/model";
import type { AppDispatch, RootState } from "../../store";
import { initializeMonaco, saveEditorCode } from "./thunks.monaco-editor";

export type EditorState = {
  monacoReady: boolean;
  tsDefaultsConfigured: boolean;
  isSaving: boolean;
};

const initialState: EditorState = {
  monacoReady: false,
  tsDefaultsConfigured: false,
  isSaving: false,
};

// ── Shared Script Extra Lib Management ────────────────────────────────────────

// Module-level disposable tracking — non-serializable, kept outside Redux state.
interface SharedLibEntry {
  disposable: { dispose(): void };
  sourceHash: string;
}
const sharedLibEntries = new Map<string, SharedLibEntry>();

/**
 * Configures the TypeScript language service compiler and diagnostics options.
 * Safe to call multiple times — `ensureTypescriptDefaults` is idempotent and
 * the `setTsDefaultsConfigured` flag prevents redundant dispatches.
 */
export const configureTypescriptDefaults = () => (dispatch: AppDispatch) => {
  ensureTypescriptDefaults();
  dispatch(setTsDefaultsConfigured());
};

/**
 * Syncs shared-script extra lib registrations with the provided list. Disposes
 * any libs whose source has changed or are no longer present, then registers
 * new/updated declarations so Monaco's TypeScript language service can resolve
 * `import { … } from "shared/…"`.
 */
export const syncSharedScriptLibs =
  (sharedScripts: SharedScriptInfo[]) => () => {
    const currentIds = new Set(sharedScripts.map((s) => s.id));

    // Dispose libs for scripts that are no longer in the dependency list
    for (const [id, entry] of sharedLibEntries) {
      if (!currentIds.has(id)) {
        entry.disposable.dispose();
        sharedLibEntries.delete(id);
      }
    }

    // Register or update extra libs for each shared script
    for (const shared of sharedScripts) {
      if (!shared.moduleName) {
        continue;
      }

      const existing = sharedLibEntries.get(shared.id);

      // Skip if the source code hasn't changed
      if (existing && existing.sourceHash === shared.sourceCode) {
        continue;
      }

      // Dispose the previous registration if updating
      if (existing) {
        existing.disposable.dispose();
      }

      const declaration = generateSharedScriptDeclaration(
        shared.moduleName,
        shared.sourceCode
      );

      const disposable = addSharedScriptExtraLib(
        declaration,
        shared.moduleName
      );

      sharedLibEntries.set(shared.id, {
        disposable,
        sourceHash: shared.sourceCode,
      });
    }
  };

// ── Slice ─────────────────────────────────────────────────────────────────────

const editorSlice = createSlice({
  name: "editor",
  initialState,
  selectors: {
    selectMonacoReady(state: EditorState) {
      return state.monacoReady;
    },
    selectTsDefaultsConfigured(state: EditorState) {
      return state.tsDefaultsConfigured;
    },
    selectIsSaving(state: EditorState) {
      return state.isSaving;
    },
  },
  reducers: {
    setTsDefaultsConfigured: (state) => {
      state.tsDefaultsConfigured = true;
    },
  },
  extraReducers: (builder) => {
    builder
      // initializeMonaco
      .addCase(initializeMonaco.fulfilled, (state) => {
        state.monacoReady = true;
      })
      .addCase(initializeMonaco.rejected, (state, action) => {
        console.error("Shiki highlighter initialization failed:", action.error);
        // Allow rendering even if Shiki initialization fails — Monarch tokenizers
        // remain active as a fallback since they are only blocked after Shiki succeeds.
        state.monacoReady = true;
      })
      // saveEditorCode
      .addCase(saveEditorCode.pending, (state) => {
        state.isSaving = true;
      })
      .addCase(saveEditorCode.fulfilled, (state) => {
        state.isSaving = false;
      })
      .addCase(saveEditorCode.rejected, (state) => {
        state.isSaving = false;
      });
  },
});

export const { setTsDefaultsConfigured } = editorSlice.actions;

export const { selectMonacoReady, selectTsDefaultsConfigured, selectIsSaving } =
  editorSlice.selectors;

// ── Parameterized Selectors ───────────────────────────────────────────────────

/**
 * Returns SharedScriptInfo[] for the given script ID's shared script dependencies.
 * Resolves the script's `sharedScripts` ID array against all scripts in the store.
 */
export const selectSharedScriptsForUserscript = (
  scriptId: string | undefined
) =>
  createSelector(
    (state: RootState) => state.userscripts.scripts,
    (scripts): SharedScriptInfo[] | undefined => {
      if (!scriptId || !scripts) {
        return undefined;
      }

      const script = scripts[scriptId];

      if (!script?.sharedScripts?.length) {
        return undefined;
      }

      return script.sharedScripts
        .map((id) => scripts[id])
        .filter((s) => s?.shared)
        .map((s) => ({
          id: s.id,
          name: s.name,
          moduleName: s.moduleName ?? "",
          sourceCode: s.code.source.typescript,
        }));
    }
  );

export default editorSlice.reducer;
