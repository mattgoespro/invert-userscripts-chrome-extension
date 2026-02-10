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
  { id: "warm-carbon", label: "Warm Carbon", accent: "#d4a054", surface: "#12100e" },
  { id: "graphite", label: "Graphite", accent: "#569cd6", surface: "#1e1e1e" },
  { id: "nordic", label: "Nordic", accent: "#88c0d0", surface: "#1a1e24" },
  { id: "obsidian", label: "Obsidian", accent: "#e2a555", surface: "#161616" },
  { id: "matte-terminal", label: "Matte Terminal", accent: "#5fcc8c", surface: "#0e1210" },
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
  {
    id: "obsidian-verdant",
    label: "Obsidian Verdant",
    accent: "#7ab88a",
    surface: "#141614",
    group: "obsidian variants",
  },
  {
    id: "obsidian-rose",
    label: "Obsidian Rose",
    accent: "#c48a9a",
    surface: "#181618",
    group: "obsidian variants",
  },
  {
    id: "obsidian-void",
    label: "Obsidian Void",
    accent: "#f0b060",
    surface: "#0c0c0c",
    group: "obsidian variants",
  },
];

const STORAGE_KEY = "invert-ide-devtools-theme";

function applyTheme(themeId: string) {
  const root = document.documentElement;
  if (themeId === "warm-carbon") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", themeId);
  }
}

export function ThemeSwitcher() {
  const [expanded, setExpanded] = useState(false);
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ?? "warm-carbon";
  });

  // Apply on mount + when activeTheme changes
  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  const handleSelect = useCallback((themeId: string) => {
    setActiveTheme(themeId);
    localStorage.setItem(STORAGE_KEY, themeId);
    applyTheme(themeId);
  }, []);

  const activeOption = THEMES.find((t) => t.id === activeTheme) ?? THEMES[0];

  return (
    <div className="theme-switcher">
      <button
        className="theme-switcher--toggle"
        onClick={() => setExpanded((prev) => !prev)}
        title="Theme Switcher (devtool)"
      >
        <span className="theme-switcher--swatch" style={{ background: activeOption.accent }} />
        <span className="theme-switcher--label">{activeOption.label}</span>
      </button>

      {expanded && (
        <div className="theme-switcher--panel">
          <div className="theme-switcher--panel-header">
            <span className="theme-switcher--panel-prefix">{"// "}</span>
            devtools: theme
          </div>
          <div className="theme-switcher--options">
            {THEMES.map((theme, index) => {
              const prevGroup = index > 0 ? THEMES[index - 1].group : undefined;
              const showSeparator = theme.group && theme.group !== prevGroup;

              return (
                <div key={theme.id}>
                  {showSeparator && (
                    <div className="theme-switcher--group-separator">
                      <span className="theme-switcher--group-label">{theme.group}</span>
                    </div>
                  )}
                  <button
                    className={
                      "theme-switcher--option" +
                      (theme.id === activeTheme ? " theme-switcher--option-active" : "")
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
                    <span className="theme-switcher--option-label">{theme.label}</span>
                    {theme.id === activeTheme && (
                      <span className="theme-switcher--option-check">&#10003;</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
