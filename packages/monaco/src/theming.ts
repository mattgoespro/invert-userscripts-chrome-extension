import { type ThemeRegistration } from "@shikijs/core";
import * as themes from "./themes";
import { CamelToKebabCase } from "./utils";

export type EditorThemeName = CamelToKebabCase<keyof typeof themes>;

/**
 * Raw TextMate theme definitions for all editor themes. All themes are statically imported and
 * pre-loaded into the Shiki highlighter at initialization, then registered with Monaco via
 * `shikiToMonaco`. Theme switching is handled entirely by Monaco's `setTheme` monkey-patch.
 */
export const EditorThemes: Record<EditorThemeName, ThemeRegistration> = {
  andromeeda: themes.andromeeda,
  "aurora-x": themes.auroraX,
  "ayu-dark": themes.ayuDark,
  "ayu-mirage": themes.ayuMirage,
  "bearded-anthracite": themes.beardedAnthracite,
  "bearded-vivid-black": themes.beardedVividBlack,
  "dark-plus": themes.darkPlus,
  dracula: themes.dracula,
  "dracula-soft": themes.draculaSoft,
  "everforest-dark": themes.everforestDark,
  "github-dark": themes.githubDark,
  "github-dark-default": themes.githubDarkDefault,
  "github-dark-dimmed": themes.githubDarkDimmed,
  "github-dark-high-contrast": themes.githubDarkHighContrast,
  "graphite-dusk": themes.graphiteDusk,
  "gruvbox-dark-hard": themes.gruvboxDarkHard,
  "gruvbox-dark-medium": themes.gruvboxDarkMedium,
  "gruvbox-dark-soft": themes.gruvboxDarkSoft,
  horizon: themes.horizon,
  houston: themes.houston,
  "invert-dark": themes.invertDark,
  "kanagawa-dragon": themes.kanagawaDragon,
  "kanagawa-wave": themes.kanagawaWave,
  laserwave: themes.laserwave,
  "material-theme": themes.materialTheme,
  "material-theme-darker": themes.materialThemeDarker,
  "material-theme-ocean": themes.materialThemeOcean,
  "material-theme-palenight": themes.materialThemePalenight,
  "min-dark": themes.minDark,
  monokai: themes.monokai,
  "monokai-pro": themes.monokaiPro,
  nord: themes.nord,
  "one-dark-pro": themes.oneDarkPro,
  plastic: themes.plastic,
  poimandres: themes.poimandres,
  "rose-pine": themes.rosePine,
  "slack-dark": themes.slackDark,
  "tokyo-night": themes.tokyoNight,
  vesper: themes.vesper,
  "vitesse-black": themes.vitesseBlack,
  "vitesse-dark": themes.vitesseDark,
};

/** The default theme registered at initialization time. */
export const DEFAULT_THEME: EditorThemeName = "invert-dark";

// ── Public API ────────────────────────────────────────────────────────────────

export function getThemeOptions(): { label: string; value: EditorThemeName }[] {
  return Object.entries(EditorThemes).map(([key, theme]) => ({
    label: theme.displayName,
    value: key as EditorThemeName,
  }));
}
