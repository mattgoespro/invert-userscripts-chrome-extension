import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { EditorSettings } from "@shared/model";
import { StorageManager } from "@shared/storage";

export type SettingsState = {
  editorSettings: EditorSettings;
  isLoading: boolean;
};

const defaultSettings: EditorSettings = {
  theme: "Invert Dark",
  fontSize: 14,
  tabSize: 2,
  autoFormat: true,
  autoSave: true,
};

const initialState: SettingsState = {
  editorSettings: defaultSettings,
  isLoading: true,
};

export const loadSettings = createAsyncThunk("settings/loadSettings", async () => {
  const settings = await StorageManager.getEditorSettings();
  return settings;
});

export const updateTheme = createAsyncThunk("settings/updateTheme", async (theme: string) => {
  await StorageManager.saveEditorSettings({ theme });
  return theme;
});

export const updateFontSize = createAsyncThunk(
  "settings/updateFontSize",
  async (fontSize: number) => {
    await StorageManager.saveEditorSettings({ fontSize });
    return fontSize;
  }
);

export const updateTabSize = createAsyncThunk("settings/updateTabSize", async (tabSize: number) => {
  await StorageManager.saveEditorSettings({ tabSize });
  return tabSize;
});

export const updateAutoFormat = createAsyncThunk(
  "settings/updateAutoFormat",
  async (autoFormat: boolean) => {
    await StorageManager.saveEditorSettings({ autoFormat });
    return autoFormat;
  }
);

export const updateAutoSave = createAsyncThunk(
  "settings/updateAutoSave",
  async (autoSave: boolean) => {
    await StorageManager.saveEditorSettings({ autoSave });
    return autoSave;
  }
);

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
    selectTheme(state: SettingsState) {
      return state.editorSettings.theme;
    },
    selectFontSize(state: SettingsState) {
      return state.editorSettings.fontSize;
    },
    selectTabSize(state: SettingsState) {
      return state.editorSettings.tabSize;
    },
    selectAutoFormat(state: SettingsState) {
      return state.editorSettings.autoFormat;
    },
    selectAutoSave(state: SettingsState) {
      return state.editorSettings.autoSave;
    },
    selectIsLoading(state: SettingsState) {
      return state.isLoading;
    },
  },
  reducers: {
    setTheme: (state, action: PayloadAction<string>) => {
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
      .addCase(updateTheme.fulfilled, (state, action) => {
        state.editorSettings.theme = action.payload;
      })
      .addCase(updateFontSize.fulfilled, (state, action) => {
        state.editorSettings.fontSize = action.payload;
      })
      .addCase(updateTabSize.fulfilled, (state, action) => {
        state.editorSettings.tabSize = action.payload;
      })
      .addCase(updateAutoFormat.fulfilled, (state, action) => {
        state.editorSettings.autoFormat = action.payload;
      })
      .addCase(updateAutoSave.fulfilled, (state, action) => {
        state.editorSettings.autoSave = action.payload;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.editorSettings = { ...state.editorSettings, ...action.payload };
      });
  },
});

export const { setTheme, setFontSize, setTabSize, setAutoFormat, setAutoSave } =
  settingsSlice.actions;

export const {
  selectEditorSettings,
  selectTheme,
  selectFontSize,
  selectTabSize,
  selectAutoFormat,
  selectAutoSave,
  selectIsLoading,
} = settingsSlice.selectors;

export default settingsSlice.reducer;
