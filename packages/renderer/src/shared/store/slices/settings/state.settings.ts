import { EditorSettings } from "@shared/model";
import { ChromeSyncStorage } from "@shared/storage";

export type SettingsState = {
  editorSettings: EditorSettings;
  isLoading: boolean;
};

export const initialState: SettingsState = {
  editorSettings: ChromeSyncStorage.defaultSettings,
  isLoading: true,
};
