import { CompilationError } from "@shared/errors";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./workspace.state";

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setScriptErrors: (
      state,
      action: PayloadAction<{
        scriptId: string;
        language: CompilationError["language"];
        errors: CompilationError[];
      }>
    ) => {
      const scriptErrors = state.scriptErrors[action.payload.scriptId] ?? {};

      scriptErrors[action.payload.language] = action.payload.errors;
      state.scriptErrors[action.payload.scriptId] = scriptErrors;
    },
    clearScriptErrors: (state, action: PayloadAction<string>) => {
      delete state.scriptErrors[action.payload];
    },
    setVisibleScriptId: (state, action: PayloadAction<string | null>) => {
      state.visibleScriptId = action.payload;
    },
  },
  selectors: {
    selectScriptErrors: (state, scriptId: string) => {
      return Object.values(state.scriptErrors[scriptId] ?? {}).flat();
    },
    selectAllErrors: (state) => {
      return Object.values(state.scriptErrors).flatMap((errorsByLanguage) =>
        Object.values(errorsByLanguage).flat()
      );
    },
    selectErrorCount: (state, scriptId: string) => {
      return Object.values(state.scriptErrors[scriptId] ?? {}).flat().length;
    },
    selectVisibleErrors: (state) => {
      if (!state.visibleScriptId) {
        return [];
      }
      return Object.values(
        state.scriptErrors[state.visibleScriptId] ?? {}
      ).flat();
    },
  },
});

export const { setScriptErrors, clearScriptErrors, setVisibleScriptId } =
  workspaceSlice.actions;

export const {
  selectScriptErrors,
  selectAllErrors,
  selectErrorCount,
  selectVisibleErrors,
} = workspaceSlice.selectors;

export default workspaceSlice.reducer;
