import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Input } from "@/shared/components/input/Input";
import { Select } from "@/shared/components/select/Select";
import { Typography } from "@/shared/components/typography/Typography";
import type { EditorThemeName } from "@shared/editor-theme";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectMonacoReady } from "@/shared/store/slices/code-editor";
import {
  selectEditorSettings,
  selectIsLoading,
} from "@/shared/store/slices/settings";
import { updateSettings } from "@/shared/store/slices/settings/thunks.settings";
import { rebuildCompiledUserscripts } from "@/shared/store/slices/userscripts/thunks.userscripts";
import { getEditorThemes } from "@packages/monaco";
import { AppThemes } from "@shared/constants";
import { AppThemeName } from "@shared/model";
import { SettingsSection } from "./SettingsSection";
import { StorageUsagePanel } from "./StorageUsagePanel";
import { ThemePreview } from "./theme-preview/ThemePreview";

export function Settings() {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const settings = useAppSelector(selectEditorSettings);
  const isLoading = useAppSelector(selectIsLoading);
  const monacoReady = useAppSelector(selectMonacoReady);

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

  const handleMinifyCompiledOutputChange = async (
    minifyCompiledOutput: boolean
  ) => {
    try {
      await dispatch(updateSettings({ minifyCompiledOutput })).unwrap();
      await dispatch(rebuildCompiledUserscripts({ scope: "all" })).unwrap();

      toast({
        variant: "info",
        message: minifyCompiledOutput
          ? "Compiled JavaScript and CSS were rebuilt with minification enabled."
          : "Compiled JavaScript and CSS were rebuilt without minification.",
      });
    } catch (error) {
      toast({
        variant: "error",
        message:
          error instanceof Error
            ? `Failed to rebuild compiled output: ${error.message}`
            : "Failed to rebuild compiled output.",
      });
    }
  };

  function getEditorThemeOptions(): {
    label: string;
    value: EditorThemeName;
  }[] {
    return getEditorThemes().map(([key, theme]) => ({
      label: theme.displayName,
      value: key as EditorThemeName,
    }));
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-(--page-padding)">
        <div className="mb-lg flex items-center gap-1 border-b border-border pb-sm">
          <span className="font-mono text-[1.25rem] text-syntax-param">
            config.
          </span>
          <Typography variant="subtitle">Settings</Typography>
        </div>
        <div className="flex items-center justify-center p-2xl">
          <Typography variant="code" className="text-text-muted">
            Loading settings...
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-(--page-padding)">
      <div className="mb-lg flex items-center gap-1 border-b border-border pb-sm">
        <span className="font-mono text-[1.25rem] text-syntax-param">
          config.
        </span>
        <Typography variant="subtitle">Settings</Typography>
      </div>
      <SettingsSection title="Application Theme">
        <Select
          label="Theme"
          value={settings.appTheme ?? "graphite"}
          onChange={handleAppThemeChange}
          options={AppThemes.map((theme) => ({
            label: theme.displayName,
            value: theme.name,
          }))}
        />
      </SettingsSection>
      <SettingsSection title="Editor Appearance">
        <Select
          label="Theme"
          value={settings.theme}
          onChange={handleThemeChange}
          options={getEditorThemeOptions()}
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
      <SettingsSection title="Build Output">
        <Checkbox
          label="Minify compiled JavaScript and CSS"
          checked={settings.minifyCompiledOutput ?? false}
          onChange={handleMinifyCompiledOutputChange}
        />
      </SettingsSection>
      <SettingsSection title="Storage Quota">
        <StorageUsagePanel />
      </SettingsSection>
    </div>
  );
}
