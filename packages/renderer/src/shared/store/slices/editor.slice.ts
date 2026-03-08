import {
  createSlice,
  createAsyncThunk,
  createSelector,
} from "@reduxjs/toolkit";
import { SharedScriptInfo, UserscriptSourceLanguage } from "@shared/model";
import {
  ensureTypescriptDefaults,
  generateSharedScriptDeclaration,
  addSharedScriptExtraLib,
  getTypescriptDefaults,
  registerMonaco,
} from "@packages/monaco";
import { PrettierFormatter } from "@/sandbox/formatter";
import { updateUserscriptCode } from "./userscripts.slice";
import type { AppDispatch, RootState } from "../store";

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

export const initializeMonaco = createAsyncThunk(
  "editor/initializeMonaco",
  async () => {
    await registerMonaco();
  }
);

// ── Shared Script Extra Lib Management ────────────────────────────────────────

// Module-level disposable tracking — non-serializable, kept outside Redux state.
const sharedLibDisposables = new Map<string, { dispose(): void }>();

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
 * Disposes all current shared-script extra lib registrations, then registers
 * ambient module declarations for each provided shared script so Monaco's
 * TypeScript language service can resolve `import { … } from "shared/…"`.
 */
export const syncSharedScriptLibs =
  (sharedScripts: SharedScriptInfo[]) => () => {
    console.warn(
      "[Invert IDE] syncSharedScriptLibs called with",
      sharedScripts.length,
      "scripts"
    );

    // Dispose previous registrations
    for (const [key, disposable] of sharedLibDisposables) {
      disposable.dispose();
      sharedLibDisposables.delete(key);
    }

    // Register extra libs for each shared script
    for (const shared of sharedScripts) {
      if (!shared.moduleName) {
        continue;
      }

      const declaration = generateSharedScriptDeclaration(
        shared.moduleName,
        shared.sourceCode
      );
      console.warn(
        "[Invert IDE] Declaration for",
        shared.moduleName,
        ":",
        declaration
      );

      const disposable = addSharedScriptExtraLib(
        declaration,
        shared.moduleName
      );
      console.warn(
        "[Invert IDE] addSharedScriptExtraLib returned:",
        typeof disposable
      );

      sharedLibDisposables.set(shared.id, disposable);
    }

    // Diagnostic: verify what's actually registered
    const tsDefaults = getTypescriptDefaults();
    console.warn("[Invert IDE] tsDefaults:", tsDefaults ? "available" : "NULL");
    if (tsDefaults) {
      console.warn(
        "[Invert IDE] Extra libs:",
        Object.keys(tsDefaults.getExtraLibs())
      );
      console.warn(
        "[Invert IDE] Compiler options:",
        tsDefaults.getCompilerOptions()
      );
    }
    console.warn("[Invert IDE] syncSharedScriptLibs complete");
  };

/**
 * Disposes all shared-script extra lib registrations.
 * Call on component unmount or when shared scripts are no longer needed.
 */
export const disposeSharedScriptLibs = () => () => {
  for (const [key, disposable] of sharedLibDisposables) {
    disposable.dispose();
    sharedLibDisposables.delete(key);
  }
};

export const saveEditorCode = createAsyncThunk(
  "editor/saveEditorCode",
  async (
    {
      scriptId,
      language,
      code,
      autoFormat,
    }: {
      scriptId: string;
      language: UserscriptSourceLanguage;
      code: string;
      autoFormat: boolean;
    },
    { dispatch }
  ) => {
    let formattedCode = code;

    if (autoFormat) {
      formattedCode = await PrettierFormatter.format(code, language);
    }

    await dispatch(
      updateUserscriptCode({ id: scriptId, language, code: formattedCode })
    ).unwrap();

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
