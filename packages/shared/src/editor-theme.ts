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

/** Resolves the editor theme setting to the Monaco theme that should be applied. */
export function resolveEditorTheme(
  setting: EditorThemeSetting | undefined,
  appTheme: AppThemeName | undefined
): EditorThemeName {
  if (!setting || setting === MatchAppEditorTheme) {
    return `invert-${appTheme ?? "cyanotype"}`;
  }

  return setting;
}
