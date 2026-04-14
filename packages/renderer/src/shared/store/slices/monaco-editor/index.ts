import { createSelector, createSlice } from "@reduxjs/toolkit";
import { SharedScriptInfo } from "@shared/model";
import type { RootState } from "../../store";
import { initializeMonaco, saveEditorCode } from "./thunks.monaco-editor";

export type EditorState = {
  monacoReady: boolean;
  isSaving: boolean;
};

const initialState: EditorState = {
  monacoReady: false,
  isSaving: false,
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const editorSlice = createSlice({
  name: "editor",
  initialState,
  selectors: {
    selectMonacoReady(state: EditorState) {
      return state.monacoReady;
    },
    selectIsSaving(state: EditorState) {
      return state.isSaving;
    },
  },
  reducers: {},
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

export const { selectMonacoReady, selectIsSaving } = editorSlice.selectors;

// ── Parameterized Selectors ───────────────────────────────────────────────────

/**
 * Returns SharedScriptInfo[] for the given script ID's shared script dependencies.
 * Resolves the script's `sharedScripts` ID array against all scripts in the store.
 */
export const selectSharedScriptsForUserscript = (scriptId: string) =>
  createSelector(
    (state: RootState) => state.userscripts.scripts,
    (scripts): SharedScriptInfo[] => {
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

/**
 * Returns the globalModules ID array for the given script ID.
 */
export const selectGlobalModuleIdsForUserscript = (scriptId: string) =>
  createSelector(
    (state: RootState) => state.userscripts.scripts,
    (scripts): string[] => {
      if (!scriptId || !scripts) {
        return undefined;
      }

      const script = scripts[scriptId];
      return script?.globalModules?.length > 0
        ? script.globalModules
        : undefined;
    }
  );

export default editorSlice.reducer;
