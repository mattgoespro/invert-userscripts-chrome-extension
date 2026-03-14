import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppThemeName } from "@shared/model";
import type { EditorThemeName } from "@packages/monaco";
import { loadSettings, updateSettings } from "./thunks.settings";
import { initialState, SettingsState } from "./state.settings";
import { ChromeSyncStorage } from "@shared/storage";

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  selectors: {
    selectEditorSettings(state: SettingsState) {
      return state.editorSettings;
    },
    selectIsLoading(state: SettingsState) {
      return state.isLoading;
    },
  },
  reducers: {
    setTheme: (state, action: PayloadAction<EditorThemeName>) => {
      state.editorSettings.theme = action.payload;
    },
    setFontSize: (state, action: PayloadAction<number>) => {
      state.editorSettings.fontSize = action.payload;
    },
    setTabSize: (state, action: PayloadAction<number>) => {
      state.editorSettings.tabSize = action.payload;
    },
    setAutoFormat: (state, action: PayloadAction<boolean>) => {
      state.editorSettings.autoFormat = action.payload;
    },
    setAutoSave: (state, action: PayloadAction<boolean>) => {
      state.editorSettings.autoSave = action.payload;
    },
    setAppTheme: (state, action: PayloadAction<AppThemeName>) => {
      state.editorSettings.appTheme = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.editorSettings = {
          ...ChromeSyncStorage.defaultSettings,
          ...action.payload,
        };
        state.isLoading = false;
      })
      .addCase(loadSettings.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.editorSettings = { ...state.editorSettings, ...action.payload };
      });
  },
});

export const {
  setTheme,
  setFontSize,
  setTabSize,
  setAutoFormat,
  setAutoSave,
  setAppTheme,
} = settingsSlice.actions;

export const { selectEditorSettings, selectIsLoading } =
  settingsSlice.selectors;

export default settingsSlice.reducer;
