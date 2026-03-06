import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { Input } from "@/shared/components/input/Input";
import { Select } from "@/shared/components/select/Select";
import { Typography } from "@/shared/components/typography/Typography";
import { EditorThemeName, getThemeOptions } from "@packages/monaco";
import { AppThemeName } from "@shared/model";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectMonacoReady } from "@/shared/store/slices/editor.slice";
import {
  loadSettings,
  selectEditorSettings,
  selectIsLoading,
  updateSettings,
} from "@/shared/store/slices/settings.slice";
import { useEffect } from "react";
import "./SettingsPage.scss";
import { ThemePreview } from "./theme-preview/ThemePreview";

const APP_THEME_OPTIONS = [
  { value: "graphite", label: "Graphite" },
  { value: "graphite-warm", label: "Graphite Warm" },
  { value: "graphite-dusk", label: "Graphite Dusk" },
  { value: "graphite-ember", label: "Graphite Ember" },
  { value: "obsidian", label: "Obsidian" },
  { value: "obsidian-deep", label: "Obsidian Deep" },
  { value: "obsidian-ember", label: "Obsidian Ember" },
  { value: "obsidian-frost", label: "Obsidian Frost" },
];

export function Settings() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectEditorSettings);
  const isLoading = useAppSelector(selectIsLoading);
  const monacoReady = useAppSelector(selectMonacoReady);

  useEffect(() => {
    dispatch(loadSettings());
  }, [dispatch]);

  const handleThemeChange = (theme: EditorThemeName) => {
    dispatch(updateSettings({ theme }));
  };

  const handleAppThemeChange = (appTheme: AppThemeName) => {
    dispatch(updateSettings({ appTheme }));
  };

  const handleFontSizeChange = (fontSize: number) => {
    if (!isNaN(fontSize) && fontSize >= 8 && fontSize <= 32) {
      dispatch(updateSettings({ fontSize }));
    }
  };

  const handleTabSizeChange = (tabSize: number) => {
    if (!isNaN(tabSize) && tabSize >= 2 && tabSize <= 8) {
      dispatch(updateSettings({ tabSize }));
    }
  };

  const handleAutoFormatChange = (autoFormat: boolean) => {
    dispatch(updateSettings({ autoFormat }));
  };

  if (isLoading) {
    return (
      <div className="settings--content">
        <div className="settings--header">
          <span className="settings--header-prefix">config.</span>
          <Typography variant="subtitle">Settings</Typography>
        </div>
        <div className="settings--loading">
          <Typography variant="code">Loading settings...</Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="settings--content">
      <div className="settings--header">
        <span className="settings--header-prefix">config.</span>
        <Typography variant="subtitle">Settings</Typography>
      </div>
      <div className="settings--section">
        <Typography variant="section-title" className="settings--section-title">
          Application Theme
        </Typography>
        <div className="settings--section-fields">
          <Select
            label="Theme"
            value={settings.appTheme ?? "graphite"}
            onChange={handleAppThemeChange}
            options={APP_THEME_OPTIONS}
          />
        </div>
      </div>
      <div className="settings--section">
        <Typography variant="section-title" className="settings--section-title">
          Editor Appearance
        </Typography>
        <div className="settings--section-fields">
          <Select
            label="Theme"
            value={settings.theme}
            onChange={handleThemeChange}
            options={getThemeOptions()}
          />
          <div className="settings--theme-preview-wrapper">
            {monacoReady && <ThemePreview theme={settings.theme} />}
          </div>
          <Input
            type="number"
            label="Font Size"
            value={settings.fontSize}
            onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
            min="8"
            max="32"
          />
        </div>
      </div>
      <div className="settings--section">
        <Typography variant="section-title" className="settings--section-title">
          Formatting
        </Typography>
        <div className="settings--section-fields">
          <Input
            type="number"
            label="Tab Size"
            value={settings.tabSize}
            onChange={(e) => handleTabSizeChange(parseInt(e.target.value))}
            min="2"
            max="8"
          />
          <Checkbox
            label="Format on save"
            checked={settings.autoFormat}
            onChange={handleAutoFormatChange}
          />
        </div>
      </div>
    </div>
  );
}
