import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { AppThemes, DefaultAppTheme } from "@shared/constants";
import { applyAppTheme } from "@/shared/utils/app-theme";

type ThemeOption = {
  id: string;
  label: string;
  accent: string;
  surface: string;
  group?: string;
};

const Themes: ThemeOption[] = AppThemes.map((theme) => ({
  id: theme.name,
  label: theme.displayName,
  surface: theme.swatches[0],
  accent: theme.swatches[3],
  group: theme.family,
}));

const STORAGE_KEY = "invert-ide-devtools-theme";

export function useActiveTheme() {
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ?? DefaultAppTheme;
  });

  useEffect(() => {
    applyAppTheme(activeTheme);
  }, [activeTheme]);

  const handleSelect = useCallback((themeId: string) => {
    setActiveTheme(themeId);
    localStorage.setItem(STORAGE_KEY, themeId);
    applyAppTheme(themeId);
  }, []);

  const activeOption = Themes.find((t) => t.id === activeTheme) ?? Themes[0];

  return { activeTheme, activeOption, handleSelect };
}

export function ThemeSwitcherIcon({ accent }: { accent: string }) {
  return (
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/10"
      style={{ background: accent }}
    />
  );
}

export function ThemeSwitcher() {
  const { activeTheme, handleSelect } = useActiveTheme();

  return (
    <div className="flex scrollbar-thin max-h-90 flex-col gap-0.5 overflow-y-auto p-1.5">
      {Themes.map((theme, index) => {
        const prevGroup = index > 0 ? Themes[index - 1].group : undefined;
        const showSeparator = theme.group && theme.group !== prevGroup;

        return (
          <div key={theme.id}>
            {showSeparator && (
              <div className="theme-switcher--group-separator">
                <span className="theme-switcher--group-label">
                  {theme.group}
                </span>
              </div>
            )}
            <button
              type="button"
              className={clsx(
                "flex h-(--button-height) items-center gap-2.5 rounded-default border-none px-2.5 py-0",
                "cursor-pointer text-left font-mono text-base",
                "transition-colors duration-100",
                theme.id === activeTheme
                  ? "bg-accent-subtle text-accent hover:bg-accent-muted hover:text-accent"
                  : "bg-transparent text-text-muted hover:bg-hover-overlay hover:text-foreground"
              )}
              onClick={() => handleSelect(theme.id)}
            >
              <span className="flex shrink-0 gap-0.75">
                <span
                  className="h-3 w-3 rounded-[3px] border border-white/8"
                  style={{ background: theme.surface }}
                />
                <span
                  className="h-3 w-3 rounded-[3px] border border-white/8"
                  style={{ background: theme.accent }}
                />
              </span>
              <span className="flex-1">{theme.label}</span>
              {theme.id === activeTheme && (
                <span className="shrink-0 text-xs text-accent">&#10003;</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
