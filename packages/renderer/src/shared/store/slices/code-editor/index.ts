import { createSlice } from "@reduxjs/toolkit";
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

export default codeEditorSlice.reducer;
