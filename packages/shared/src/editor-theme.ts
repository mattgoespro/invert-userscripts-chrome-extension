import { AppThemes, resolveAppTheme } from "./constants";
import type { AppThemeName } from "./model";

/** Editor themes in the Invert family, one per app theme. */
export type InvertEditorThemeName = `invert-${AppThemeName}`;

export type EditorThemeName =
  | "bearded-vivid-black"
  | "dark-plus"
  | "github-dark"
  | "github-dark-default"
  | "github-dark-dimmed"
  | "invert-dark"
  | InvertEditorThemeName
  | "min-dark"
  | "one-dark-pro"
  | "plastic"
  | "slack-dark"
  | "vitesse-black"
  | "vitesse-dark";

/** Editor theme setting: a specific theme, or follow the app theme. */
export type EditorThemeSetting = EditorThemeName | "match-app";

export const MatchAppEditorTheme = "match-app" as const;

/** Non app-derived editor themes; the Record type keeps this in step with EditorThemeName. */
const StandaloneEditorThemes: Record<
  Exclude<EditorThemeName, InvertEditorThemeName>,
  true
> = {
  "bearded-vivid-black": true,
  "dark-plus": true,
  "github-dark": true,
  "github-dark-default": true,
  "github-dark-dimmed": true,
  "invert-dark": true,
  "min-dark": true,
  "one-dark-pro": true,
  plastic: true,
  "slack-dark": true,
  "vitesse-black": true,
  "vitesse-dark": true,
};

const EditorThemeNames: ReadonlySet<string> = new Set([
  ...Object.keys(StandaloneEditorThemes),
  ...AppThemes.map((theme) => `invert-${theme.name}`),
]);

/**
 * Resolves the editor theme setting to the Monaco theme that should be applied.
 * Removed or unknown stored themes follow the app theme, since Shiki throws on them.
 */
export function resolveEditorTheme(
  setting: EditorThemeSetting | undefined,
  appTheme: AppThemeName | undefined
): EditorThemeName {
  if (setting && EditorThemeNames.has(setting)) {
    return setting as EditorThemeName;
  }

  return `invert-${resolveAppTheme(appTheme)}`;
}
