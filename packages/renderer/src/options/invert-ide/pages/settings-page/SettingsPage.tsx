import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { useState } from "react";
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
import { DefaultAppTheme } from "@shared/constants";
import clsx from "clsx";
import { AppThemePicker } from "./theme-picker/AppThemePicker";
import { AppThemeName } from "@shared/model";
import { SettingsSection } from "./SettingsSection";
import { StorageUsagePanel } from "./StorageUsagePanel";
import { ThemePreview } from "./theme-preview/ThemePreview";
import { DocumentStoragePanel } from "./DocumentStoragePanel";

type SettingsSectionId = "appearance" | "editor" | "build" | "advanced";

const SETTINGS_SECTIONS: { id: SettingsSectionId; label: string }[] = [
  { id: "appearance", label: "Appearance" },
  { id: "editor", label: "Editing" },
  { id: "build", label: "Build output" },
  { id: "advanced", label: "Advanced" },
];

const SECTION_ANCHORS: Record<SettingsSectionId, string> = {
  appearance: "settings-appearance",
  editor: "settings-editing",
  build: "settings-build",
  advanced: "advanced-settings",
};

const navItemClass =
  "flex h-8 w-full cursor-pointer items-center rounded-default px-2.5 text-left text-base transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

export function Settings() {
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const settings = useAppSelector(selectEditorSettings);
  const isLoading = useAppSelector(selectIsLoading);
  const monacoReady = useAppSelector(selectMonacoReady);
  const [advanced, setAdvanced] = useState(false);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("appearance");

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

  const handleErrorLensChange = (errorLens: boolean): void => {
    dispatch(updateSettings({ errorLens }));
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

  const scrollToSection = (id: SettingsSectionId) => {
    setActiveSection(id);
    if (id === "advanced" && !advanced) {
      setAdvanced(true);
    }
    requestAnimationFrame(() =>
      document
        .getElementById(SECTION_ANCHORS[id])
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  const header = (
    <div className="mb-lg flex shrink-0 flex-col gap-1">
      <Typography variant="subtitle">Settings</Typography>
      <Typography variant="body">
        Changes save automatically and sync with your other settings.
      </Typography>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-(--page-padding)">
        {header}
        <div className="flex items-center justify-center p-2xl">
          <Typography variant="body">Loading settings...</Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-(--page-padding)">
      {header}
      <div className="flex min-h-0 flex-1 gap-xl">
        <nav
          aria-label="Settings sections"
          className="flex w-44 shrink-0 flex-col gap-0.5"
        >
          {SETTINGS_SECTIONS.map((section) =>
            section.id === "advanced" ? (
              <button
                key={section.id}
                type="button"
                aria-expanded={advanced}
                aria-controls="advanced-settings"
                onClick={() => {
                  if (advanced) {
                    setAdvanced(false);
                    setActiveSection("appearance");
                  } else {
                    scrollToSection("advanced");
                  }
                }}
                className={clsx(
                  navItemClass,
                  advanced
                    ? "bg-selected font-semibold text-foreground"
                    : "text-text-muted hover:bg-hover-overlay hover:text-foreground"
                )}
              >
                {section.label}
              </button>
            ) : (
              <button
                key={section.id}
                type="button"
                aria-current={activeSection === section.id ? "true" : undefined}
                onClick={() => scrollToSection(section.id)}
                className={clsx(
                  navItemClass,
                  activeSection === section.id && !advanced
                    ? "bg-selected font-semibold text-foreground"
                    : "text-text-muted hover:bg-hover-overlay hover:text-foreground"
                )}
              >
                {section.label}
              </button>
            )
          )}
        </nav>
        <section
          aria-label="Settings content"
          tabIndex={0}
          className="max-w-3xl scrollbar-thin-6 min-h-0 min-w-0 flex-1 [scrollbar-gutter:stable] overflow-x-hidden overflow-y-auto overscroll-contain pr-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <div id={SECTION_ANCHORS.appearance}>
            <SettingsSection
              title="App theme"
              description="Colors for the IDE and popup. Each theme reserves its signal color for things that need your attention."
            >
              <AppThemePicker
                value={settings.appTheme ?? DefaultAppTheme}
                onChange={handleAppThemeChange}
              />
            </SettingsSection>
            <SettingsSection
              title="Editor theme"
              description="Syntax colors inside the code editors."
            >
              <Select
                label="Editor theme"
                value={settings.theme}
                onChange={handleThemeChange}
                options={getEditorThemeOptions()}
              />
              <div className="pt-1">
                {monacoReady && <ThemePreview theme={settings.theme} />}
              </div>
              <Input
                type="number"
                label="Font size"
                value={settings.fontSize}
                onChange={(event) =>
                  handleFontSizeChange(parseInt(event.target.value))
                }
                min="8"
                max="32"
                className="max-w-40"
              />
            </SettingsSection>
          </div>
          <div id={SECTION_ANCHORS.editor}>
            <SettingsSection title="Editing">
              <fieldset aria-describedby="error-lens-description">
                <legend className="mb-1 text-xs font-medium text-label-fg">
                  Error Lens
                </legend>
                <p
                  id="error-lens-description"
                  className="mb-3 text-base text-text-muted-strong"
                >
                  Highlight problem lines and show diagnostic messages inline.
                </p>
                <div className="flex gap-5">
                  <label className="flex cursor-pointer items-center gap-2 text-base text-foreground">
                    <input
                      type="radio"
                      name="error-lens"
                      value="on"
                      className="accent-selected-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      checked={settings.errorLens ?? true}
                      onChange={() => handleErrorLensChange(true)}
                    />
                    On
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-base text-foreground">
                    <input
                      type="radio"
                      name="error-lens"
                      value="off"
                      className="accent-selected-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      checked={settings.errorLens === false}
                      onChange={() => handleErrorLensChange(false)}
                    />
                    Off
                  </label>
                </div>
              </fieldset>
              <Input
                type="number"
                label="Tab size"
                value={settings.tabSize}
                onChange={(event) =>
                  handleTabSizeChange(parseInt(event.target.value))
                }
                min="2"
                max="8"
                className="max-w-40"
              />
              <Checkbox
                label="Format on save"
                checked={settings.autoFormat}
                onChange={handleAutoFormatChange}
              />
            </SettingsSection>
          </div>
          <div id={SECTION_ANCHORS.build}>
            <SettingsSection
              title="Build output"
              description="How compiled JavaScript and CSS are written for injection."
            >
              <Checkbox
                label="Minify compiled JavaScript and CSS"
                checked={settings.minifyCompiledOutput ?? false}
                onChange={handleMinifyCompiledOutputChange}
              />
            </SettingsSection>
          </div>
          <div id="advanced-settings" hidden={!advanced}>
            <SettingsSection
              title="Document storage and sync"
              description="Google Drive sync, local document storage and recovery."
            >
              <DocumentStoragePanel />
            </SettingsSection>
            <SettingsSection
              title="Storage Quota"
              description="What the extension keeps in Chrome storage, for troubleshooting."
            >
              <StorageUsagePanel />
            </SettingsSection>
          </div>
        </section>
      </div>
    </div>
  );
}
