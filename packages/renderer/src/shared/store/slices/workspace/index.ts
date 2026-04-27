import { CompilationError } from "@shared/errors";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./workspace.state";

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setScriptErrors: (
      state,
      action: PayloadAction<{ scriptId: string; errors: CompilationError[] }>
    ) => {
      state.scriptErrors[action.payload.scriptId] = action.payload.errors;
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
      return state.scriptErrors[scriptId] ?? [];
    },
    selectAllErrors: (state) => {
      return Object.values(state.scriptErrors).flat();
    },
    selectErrorCount: (state, scriptId: string) => {
      return (state.scriptErrors[scriptId] ?? []).length;
    },
    selectVisibleErrors: (state) => {
      if (!state.visibleScriptId) {
        return [];
      }
      return state.scriptErrors[state.visibleScriptId] ?? [];
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
