import { EditorSettings } from "@shared/model";
import { defaultSettings } from "@shared/storage";

export type SettingsState = {
  editorSettings: EditorSettings;
  isLoading: boolean;
};

export const initialState: SettingsState = {
  editorSettings: defaultSettings,
  isLoading: true,
};
