import { useCallback, useEffect, useState } from "react";
import "./ThemeSwitcher.scss";

type ThemeOption = {
  id: string;
  label: string;
  accent: string;
  surface: string;
  group?: string;
};

const THEMES: ThemeOption[] = [
  { id: "graphite", label: "Graphite", accent: "#569cd6", surface: "#1e1e1e" },
  { id: "obsidian", label: "Obsidian", accent: "#e2a555", surface: "#161616" },
  // Graphite variants
  {
    id: "graphite-warm",
    label: "Graphite Warm",
    accent: "#d4a054",
    surface: "#1e1e1e",
    group: "graphite variants",
  },
  {
    id: "graphite-dusk",
    label: "Graphite Dusk",
    accent: "#a088c8",
    surface: "#1e1d20",
    group: "graphite variants",
  },
  {
    id: "graphite-ember",
    label: "Graphite Ember",
    accent: "#d4785a",
    surface: "#1e1e1e",
    group: "graphite variants",
  },
  // Obsidian variants
  {
    id: "obsidian-deep",
    label: "Obsidian Deep",
    accent: "#cc9650",
    surface: "#101010",
    group: "obsidian variants",
  },
  {
    id: "obsidian-ember",
    label: "Obsidian Ember",
    accent: "#d4785a",
    surface: "#181414",
    group: "obsidian variants",
  },
  {
    id: "obsidian-frost",
    label: "Obsidian Frost",
    accent: "#8aacc8",
    surface: "#141618",
    group: "obsidian variants",
  },
];

const STORAGE_KEY = "invert-ide-devtools-theme";

function applyTheme(themeId: string) {
  const root = document.documentElement;
  if (themeId === "graphite") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", themeId);
  }
}

export function useActiveTheme() {
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ?? "graphite";
  });

  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  const handleSelect = useCallback((themeId: string) => {
    setActiveTheme(themeId);
    localStorage.setItem(STORAGE_KEY, themeId);
    applyTheme(themeId);
  }, []);

  const activeOption = THEMES.find((t) => t.id === activeTheme) ?? THEMES[0];

  return { activeTheme, activeOption, handleSelect };
}

export function ThemeSwitcherIcon({ accent }: { accent: string }) {
  return (
    <span className="theme-switcher--swatch" style={{ background: accent }} />
  );
}

export function ThemeSwitcher() {
  const { activeTheme, handleSelect } = useActiveTheme();

  return (
    <div className="theme-switcher--options">
      {THEMES.map((theme, index) => {
        const prevGroup = index > 0 ? THEMES[index - 1].group : undefined;
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
              className={
                "theme-switcher--option" +
                (theme.id === activeTheme
                  ? " theme-switcher--option-active"
                  : "")
              }
              onClick={() => handleSelect(theme.id)}
            >
              <span className="theme-switcher--option-swatches">
                <span
                  className="theme-switcher--option-swatch"
                  style={{ background: theme.surface }}
                />
                <span
                  className="theme-switcher--option-swatch"
                  style={{ background: theme.accent }}
                />
              </span>
              <span className="theme-switcher--option-label">
                {theme.label}
              </span>
              {theme.id === activeTheme && (
                <span className="theme-switcher--option-check">&#10003;</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
