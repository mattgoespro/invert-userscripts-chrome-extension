import { type ThemeRegistration } from "@shikijs/core";
import type { EditorThemeName } from "@shared/editor-theme";
import * as themes from "./themes";

/**
 * Raw TextMate theme definitions for all editor themes. All themes are statically imported and
 * pre-loaded into the Shiki highlighter at initialization, then registered with Monaco via
 * `shikiToMonaco`. Theme switching is handled entirely by Monaco's `setTheme` monkey-patch.
 */
export const EditorThemes: Record<EditorThemeName, ThemeRegistration> = {
  "bearded-vivid-black": themes.beardedVividBlack,
  "dark-plus": themes.darkPlus,
  "github-dark": themes.githubDark,
  "github-dark-default": themes.githubDarkDefault,
  "github-dark-dimmed": themes.githubDarkDimmed,
  "invert-cyanotype": themes.invertCyanotype,
  "invert-print": themes.invertPrint,
  "invert-graphite": themes.invertGraphite,
  "invert-graphite-warm": themes.invertGraphiteWarm,
  "invert-graphite-dusk": themes.invertGraphiteDusk,
  "invert-graphite-ember": themes.invertGraphiteEmber,
  "invert-obsidian": themes.invertObsidian,
  "invert-obsidian-deep": themes.invertObsidianDeep,
  "invert-obsidian-ember": themes.invertObsidianEmber,
  "invert-obsidian-frost": themes.invertObsidianFrost,
  "invert-dark": themes.invertDark,
  "min-dark": themes.minDark,
  "one-dark-pro": themes.oneDarkPro,
  plastic: themes.plastic,
  "slack-dark": themes.slackDark,
  "vitesse-black": themes.vitesseBlack,
  "vitesse-dark": themes.vitesseDark,
};

/**
 * The default theme registered at initialization time.
 */
export const EditorDefaultTheme: EditorThemeName = "invert-cyanotype";

/**
 * Gets the editor theme names and their corresponding TextMate theme definitions.
 *
 * @returns An array of tuples, where each tuple contains an editor theme name and its TextMate theme definition.
 */
export function getEditorThemes() {
  return Object.entries(EditorThemes);
}
