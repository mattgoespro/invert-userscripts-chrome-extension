import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { Input } from "@/shared/components/input/Input";
import { Select } from "@/shared/components/select/Select";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectMonacoReady } from "@/shared/store/slices/monaco-editor";
import {
  selectEditorSettings,
  selectIsLoading,
} from "@/shared/store/slices/settings";
import {
  loadSettings,
  updateSettings,
} from "@/shared/store/slices/settings/thunks.settings";
import { EditorThemeName, getThemeOptions } from "@packages/monaco";
import { AppThemeName } from "@shared/model";
import { useEffect } from "react";
import { SettingsSection } from "./SettingsSection";
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
      <div className="flex-1 p-(--page-padding)">
        <div className="mb-lg pb-sm border-border flex items-center gap-1 border-b">
          <span className="text-syntax-param font-mono text-[1.25rem]">
            config.
          </span>
          <Typography variant="subtitle">Settings</Typography>
        </div>
        <div className="p-2xl flex items-center justify-center">
          <Typography variant="code" className="text-text-muted">
            Loading settings...
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-(--page-padding)">
      <div className="mb-lg pb-sm border-border flex items-center gap-1 border-b">
        <span className="text-syntax-param font-mono text-[1.25rem]">
          config.
        </span>
        <Typography variant="subtitle">Settings</Typography>
      </div>
      <SettingsSection title="Application Theme">
        <Select
          label="Theme"
          value={settings.appTheme ?? "graphite"}
          onChange={handleAppThemeChange}
          options={APP_THEME_OPTIONS}
        />
      </SettingsSection>
      <SettingsSection title="Editor Appearance">
        <Select
          label="Theme"
          value={settings.theme}
          onChange={handleThemeChange}
          options={getThemeOptions()}
        />
        <div className="pt-1">
          {monacoReady && <ThemePreview theme={settings.theme} />}
        </div>
        <Input
          type="number"
          label="Font Size"
          value={settings.fontSize}
          onChange={(event) =>
            handleFontSizeChange(parseInt(event.target.value))
          }
          min="8"
          max="32"
        />
      </SettingsSection>
      <SettingsSection title="Formatting">
        <Input
          type="number"
          label="Tab Size"
          value={settings.tabSize}
          onChange={(event) =>
            handleTabSizeChange(parseInt(event.target.value))
          }
          min="2"
          max="8"
        />
        <Checkbox
          label="Format on save"
          checked={settings.autoFormat}
          onChange={handleAutoFormatChange}
        />
      </SettingsSection>
    </div>
  );
}
