import { createSelector, createSlice } from "@reduxjs/toolkit";
import { SharedScriptInfo } from "@shared/model";
import { toSharedScriptInfo } from "@packages/monaco";
import type { RootState } from "../../store";
import {
  initializeMonaco,
  saveEditorCode,
  setIdeReady,
} from "./thunks.code-editor";
import { initialState, MonacoEditorState } from "./state.code-editor";

const codeEditorSlice = createSlice({
  name: "editor",
  initialState,
  selectors: {
    selectMonacoReady(state: MonacoEditorState) {
      return state.monacoReady;
    },
    selectIdeReady(state: MonacoEditorState) {
      return state.ideReady;
    },
    selectIsSaving(state: MonacoEditorState) {
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
      .addCase(setIdeReady, (state, action) => {
        state.ideReady = action.payload;
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

export const { selectMonacoReady, selectIdeReady, selectIsSaving } =
  codeEditorSlice.selectors;

export const selectAllSharedScriptInfos = createSelector(
  (state: RootState) => state.userscripts.scripts,
  (state: RootState) => state.editorDrafts.drafts,
  (scripts, drafts): SharedScriptInfo[] =>
    Object.values(scripts ?? {})
      .map((script) => {
        const draft = drafts[script.id];
        const info = toSharedScriptInfo({
          ...script,
          code: {
            ...script.code,
            source: {
              ...script.code.source,
              typescript:
                (draft?.dirty.typescript ?? false)
                  ? draft.typescript
                  : script.code.source.typescript,
            },
          },
          typeDefinitions:
            (draft?.dirty.typeDefinitions ?? false)
              ? draft.typeDefinitions
              : script.typeDefinitions,
        });

        return info;
      })
      .filter((info): info is SharedScriptInfo => info != null)
);

/**
 * Returns SharedScriptInfo[] for the given script ID's shared script dependencies.
 * Resolves the script's `sharedScripts` ID array against all scripts in the store.
 */
export const selectSharedScriptsForUserscript = (scriptId: string) =>
  createSelector(
    (state: RootState) => state.userscripts.scripts,
    (state: RootState) => state.editorDrafts.drafts,
    (scripts, drafts): SharedScriptInfo[] => {
      if (!scriptId || !scripts) {
        return undefined;
      }

      const script = scripts[scriptId];

      if (!script?.sharedScripts?.length) {
        return undefined;
      }

      return script.sharedScripts
        .map((id) => {
          const sharedScript = scripts[id];

          if (!sharedScript?.shared) {
            return null;
          }

          const draft = drafts[id];

          return toSharedScriptInfo({
            ...sharedScript,
            code: {
              ...sharedScript.code,
              source: {
                ...sharedScript.code.source,
                typescript:
                  (draft?.dirty.typescript ?? false)
                    ? draft.typescript
                    : sharedScript.code.source.typescript,
              },
            },
            typeDefinitions:
              (draft?.dirty.typeDefinitions ?? false)
                ? draft.typeDefinitions
                : sharedScript.typeDefinitions,
          });
        })
        .filter((info): info is SharedScriptInfo => info != null);
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

export default codeEditorSlice.reducer;
