import { createAsyncThunk } from "@reduxjs/toolkit/react";
import { EditorSettings } from "@shared/model";
import { ChromeSyncStorage } from "@shared/storage";

export const loadSettings = createAsyncThunk(
  "settings/loadSettings",
  async () => {
    const settings = await ChromeSyncStorage.getEditorSettings();
    return settings;
  }
);

export const updateSettings = createAsyncThunk(
  "settings/updateSettings",
  async (updates: Partial<EditorSettings>) => {
    await ChromeSyncStorage.saveEditorSettings(updates);
    return updates;
  }
);
