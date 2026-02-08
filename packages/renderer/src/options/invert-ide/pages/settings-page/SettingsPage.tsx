import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { CodeEditorThemeNames } from "@/shared/components/CodeEditorThemes";
import { Input } from "@/shared/components/input/Input";
import { Select } from "@/shared/components/select/Select";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  loadSettings,
  selectEditorSettings,
  selectIsLoading,
  updateAutoFormat,
  updateFontSize,
  updateTabSize,
  updateTheme,
} from "@/shared/store/slices/settings.slice";
import { useEffect } from "react";
import "./SettingsPage.scss";
import { ThemePreview } from "./theme-preview/ThemePreview";

export function Settings() {
  const dispatch = useAppDispatch();
  const settings = useAppSelector(selectEditorSettings);
  const isLoading = useAppSelector(selectIsLoading);

  useEffect(() => {
    dispatch(loadSettings());
  }, [dispatch]);

  const handleThemeChange = (theme: string) => {
    dispatch(updateTheme(theme));
  };

  const handleFontSizeChange = (fontSize: number) => {
    if (!isNaN(fontSize) && fontSize >= 8 && fontSize <= 32) {
      dispatch(updateFontSize(fontSize));
    }
  };

  const handleTabSizeChange = (tabSize: number) => {
    if (!isNaN(tabSize) && tabSize >= 2 && tabSize <= 8) {
      dispatch(updateTabSize(tabSize));
    }
  };

  const handleAutoFormatChange = (autoFormat: boolean) => {
    dispatch(updateAutoFormat(autoFormat));
  };

  if (isLoading) {
    return (
      <div className="settings--content">
        <div className="settings--header">
          <span className="settings--header-prefix">config.</span>
          <Typography variant="subtitle">Settings</Typography>
        </div>
        <div className="settings--loading">Loading settings...</div>
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
        <h3 className="settings--section-title">Editor Appearance</h3>
        <div className="settings--section-fields">
          <Select
            label="Theme"
            value={settings.theme}
            onChange={handleThemeChange}
            options={CodeEditorThemeNames.map((themeName) => ({ value: themeName }))}
          />
          <div className="settings--theme-preview-wrapper">
            <ThemePreview theme={settings.theme} />
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
        <h3 className="settings--section-title">Formatting</h3>
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
