import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Select } from "@/shared/components/select/Select";
import { Typography } from "@/shared/components/typography/Typography";
import {
  MatchAppEditorTheme,
  type EditorThemeSetting,
} from "@shared/editor-theme";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectMonacoReady } from "@/shared/store/slices/code-editor";
import {
  selectEditorSettings,
  selectIsLoading,
} from "@/shared/store/slices/settings";
import { updateSettings } from "@/shared/store/slices/settings/thunks.settings";
import { rebuildCompiledUserscripts } from "@/shared/store/slices/userscripts/thunks.userscripts";
import { getEditorThemes } from "@packages/monaco";
import { resolveAppTheme } from "@shared/constants";
import clsx from "clsx";
import { AppThemePicker } from "./theme-picker/AppThemePicker";
import { AppThemeName } from "@shared/model";
import { SettingsSection } from "./SettingsSection";
import { StorageUsagePanel } from "./StorageUsagePanel";
import { ThemePreview } from "./theme-preview/ThemePreview";
import { DocumentStoragePanel } from "./DocumentStoragePanel";
import { NumberSettingInput } from "./NumberSettingInput";
import {
  consumeSettingsSectionRequest,
  subscribeToSettingsSectionRequests,
  type SettingsSectionId,
} from "./settings-navigation";

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
  const [requestedSection, setRequestedSection] =
    useState<SettingsSectionId | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  // A section picked in the nav stays highlighted until the user scrolls the
  // content themselves; short sections near the end can't reach the middle.
  const pickedSectionRef = useRef<SettingsSectionId | null>(null);

  // Scroll spy: highlight the section that crosses the middle of the content.
  useEffect(() => {
    const content = contentRef.current;
    if (isLoading || !content) {
      return;
    }
    const updateActiveSection = (): void => {
      if (pickedSectionRef.current) {
        setActiveSection(pickedSectionRef.current);
        return;
      }
      const bounds = content.getBoundingClientRect();
      // Sections near the end can't reach the middle, so the bottom of the
      // scroll range selects the last visible section.
      const atBottom =
        content.scrollHeight > content.clientHeight &&
        content.scrollTop + content.clientHeight >= content.scrollHeight - 2;
      const middle = bounds.top + bounds.height / 2;
      let current: SettingsSectionId = SETTINGS_SECTIONS[0].id;
      for (const section of SETTINGS_SECTIONS) {
        const element = document.getElementById(SECTION_ANCHORS[section.id]);
        if (!element || element.hidden) {
          continue;
        }
        const top = element.getBoundingClientRect().top;
        if (top <= middle || atBottom) {
          current = section.id;
        }
      }
      setActiveSection(current);
    };
    const releasePickedSection = (): void => {
      pickedSectionRef.current = null;
    };
    const releaseOnScrollKey = (event: KeyboardEvent): void => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      ) {
        releasePickedSection();
      }
    };
    const userScrollEvents = ["wheel", "touchstart", "pointerdown"] as const;
    updateActiveSection();
    content.addEventListener("scroll", updateActiveSection, { passive: true });
    for (const type of userScrollEvents) {
      content.addEventListener(type, releasePickedSection, { passive: true });
    }
    content.addEventListener("keydown", releaseOnScrollKey);
    const observer = new ResizeObserver(updateActiveSection);
    observer.observe(content);
    for (const child of Array.from(content.children)) {
      observer.observe(child);
    }
    return () => {
      content.removeEventListener("scroll", updateActiveSection);
      for (const type of userScrollEvents) {
        content.removeEventListener(type, releasePickedSection);
      }
      content.removeEventListener("keydown", releaseOnScrollKey);
      observer.disconnect();
    };
  }, [isLoading, advanced]);

  const handleThemeChange = (theme: EditorThemeSetting) => {
    dispatch(updateSettings({ theme }));
  };

  const handleAppThemeChange = (appTheme: AppThemeName) => {
    dispatch(updateSettings({ appTheme }));
  };

  const handleFontSizeChange = (fontSize: number) => {
    dispatch(updateSettings({ fontSize }));
  };

  const handleTabSizeChange = (tabSize: number) => {
    dispatch(updateSettings({ tabSize }));
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
    value: EditorThemeSetting;
  }[] {
    const themes = getEditorThemes().map(([key, theme]) => ({
      label: theme.displayName,
      value: key as EditorThemeSetting,
    }));
    const isFamily = (value: string): boolean =>
      value.startsWith("invert-") && value !== "invert-dark";
    return [
      { label: "Match app theme", value: MatchAppEditorTheme },
      ...themes.filter((theme) => isFamily(theme.value)),
      ...themes
        .filter((theme) => !isFamily(theme.value))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }

  const scrollToSection = (id: SettingsSectionId) => {
    pickedSectionRef.current = id;
    setActiveSection(id);
    if (id === "advanced" && !advanced) {
      setAdvanced(true);
    }
    // Scroll only the settings content, never the page around it.
    requestAnimationFrame(() => {
      const content = contentRef.current;
      const target = document.getElementById(SECTION_ANCHORS[id]);
      if (!content || !target) {
        return;
      }
      const offset =
        target.getBoundingClientRect().top -
        content.getBoundingClientRect().top;
      content.scrollTo({ top: content.scrollTop + offset, behavior: "smooth" });
    });
  };

  // Other surfaces can ask for a section, whether or not this page is open yet.
  useEffect(() => {
    if (isLoading) {
      return;
    }
    const takeRequest = (): void => {
      const section = consumeSettingsSectionRequest();
      if (section) {
        if (section === "advanced") {
          setAdvanced(true);
        }
        setRequestedSection(section);
      }
    };
    takeRequest();
    return subscribeToSettingsSectionRequests(takeRequest);
  }, [isLoading]);

  // Scroll after the commit, once a requested Advanced section is laid out.
  useEffect(() => {
    if (requestedSection) {
      scrollToSection(requestedSection);
      setRequestedSection(null);
    }
  }, [requestedSection]);

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
                aria-current={activeSection === "advanced" ? "true" : undefined}
                aria-controls="advanced-settings"
                onClick={() => {
                  if (advanced) {
                    pickedSectionRef.current = null;
                    setAdvanced(false);
                  } else {
                    scrollToSection("advanced");
                  }
                }}
                className={clsx(
                  navItemClass,
                  activeSection === "advanced"
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
                  activeSection === section.id
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
          ref={contentRef}
          aria-label="Settings content"
          tabIndex={0}
          className="scrollbar-thin-6 min-h-0 max-w-3xl min-w-0 flex-1 [scrollbar-gutter:stable] overflow-x-hidden overflow-y-auto overscroll-contain pr-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <div id={SECTION_ANCHORS.appearance}>
            <SettingsSection
              title="App theme"
              description="Colors for the IDE and popup. Each theme reserves its signal color for things that need your attention."
            >
              <AppThemePicker
                value={resolveAppTheme(settings.appTheme)}
                onChange={handleAppThemeChange}
              />
            </SettingsSection>
            <SettingsSection
              title="Editor theme"
              description="Syntax colors inside the code editors. Match app theme keeps the editors in step with the theme above."
            >
              <Select
                label="Editor theme"
                value={settings.theme ?? MatchAppEditorTheme}
                onChange={handleThemeChange}
                options={getEditorThemeOptions()}
              />
              <div className="pt-1">
                {monacoReady && (
                  <ThemePreview theme={settings.theme ?? MatchAppEditorTheme} />
                )}
              </div>
              <NumberSettingInput
                label="Font size"
                value={settings.fontSize}
                min={8}
                max={32}
                onCommit={handleFontSizeChange}
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
              <NumberSettingInput
                label="Tab size"
                value={settings.tabSize}
                min={2}
                max={8}
                onCommit={handleTabSizeChange}
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
