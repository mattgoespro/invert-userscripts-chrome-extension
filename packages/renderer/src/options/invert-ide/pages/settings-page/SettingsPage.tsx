import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { Input } from "@/shared/components/input/Input";
import { Select } from "@/shared/components/select/Select";
import { Typography } from "@/shared/components/typography/Typography";
import { EditorThemeName, getThemeOptions } from "@packages/monaco";
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
