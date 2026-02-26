import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { EditorSettings } from "@shared/model";
import { defaultSettings, StorageManager } from "@shared/storage";
import type { EditorThemeName } from "@packages/monaco";

export type SettingsState = {
  editorSettings: EditorSettings;
  isLoading: boolean;
};

const initialState: SettingsState = {
  editorSettings: defaultSettings,
  isLoading: true,
};

export const loadSettings = createAsyncThunk("settings/loadSettings", async () => {
  const settings = await StorageManager.getEditorSettings();
  return settings;
});

export const updateSettings = createAsyncThunk(
  "settings/updateSettings",
  async (updates: Partial<EditorSettings>) => {
    await StorageManager.saveEditorSettings(updates);
    return updates;
  }
);

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
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.editorSettings = { ...defaultSettings, ...action.payload };
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

export const { setTheme, setFontSize, setTabSize, setAutoFormat, setAutoSave } =
  settingsSlice.actions;

export const { selectEditorSettings, selectIsLoading } = settingsSlice.selectors;

export default settingsSlice.reducer;
