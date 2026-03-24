import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";

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
    <span
      className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/10"
      style={{ background: accent }}
    />
  );
}

export function ThemeSwitcher() {
  const { activeTheme, handleSelect } = useActiveTheme();

  return (
    <div className="scrollbar-thin flex max-h-90 flex-col gap-0.5 overflow-y-auto p-1.5">
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
              className={clsx(
                "flex items-center gap-2.5 rounded-[3px] border-none px-2.5 py-2",
                "cursor-pointer text-left font-mono text-[11px]",
                "transition-colors duration-100",
                theme.id === activeTheme
                  ? "text-accent bg-accent-subtle hover:bg-accent-muted hover:text-accent"
                  : "text-text-muted hover:bg-hover-overlay hover:text-foreground bg-transparent"
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
                <span className="text-accent shrink-0 text-xs">&#10003;</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
