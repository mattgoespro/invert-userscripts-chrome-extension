import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import { SharedScriptInfo, UserscriptSourceCode } from "@shared/model";
import { registerMonaco } from "@packages/monaco";
import { PrettierFormatter } from "@/sandbox/formatter";
import { updateUserscriptCode } from "./userscripts.slice";
import type { RootState } from "../store";

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

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const initializeMonaco = createAsyncThunk("editor/initializeMonaco", async () => {
  await registerMonaco();
});

export const saveEditorCode = createAsyncThunk(
  "editor/saveEditorCode",
  async (
    {
      scriptId,
      language,
      code,
      autoFormat,
    }: { scriptId: string; language: UserscriptSourceCode; code: string; autoFormat: boolean },
    { dispatch }
  ) => {
    let formattedCode = code;

    if (autoFormat) {
      formattedCode = await PrettierFormatter.format(code, language);
    }

    await dispatch(updateUserscriptCode({ id: scriptId, language, code: formattedCode })).unwrap();

    return { code: formattedCode };
  }
);

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
export const selectSharedScriptsForUserscript = (scriptId: string | undefined) =>
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
