import { AppThemeName } from "./model";

export type AppThemeFamily =
  | "Matte Grey"
  | "Obsidian"
  | "Graphite"
  | "Basalt"
  | "Carbon";

export interface AppThemeDefinition {
  name: AppThemeName;
  displayName: string;
  description: string;
  family: AppThemeFamily;
  /** Representative colors for theme pickers: chrome, raised surface, selection, accent. */
  swatches: [string, string, string, string];
}

export const DefaultAppTheme: AppThemeName = "matte-grey";

export const AppThemes: AppThemeDefinition[] = [
  {
    name: "matte-grey",
    displayName: "Matte Grey",
    description: "Neutral grey with an amber signal",
    family: "Matte Grey",
    swatches: ["#1c1c1c", "#222222", "#4a74a3", "#e0a85a"],
  },
  {
    name: "obsidian",
    displayName: "Obsidian",
    description: "Volcanic glass with a molten gold signal",
    family: "Obsidian",
    swatches: ["#0e0e0e", "#141414", "#4e7a66", "#e2a555"],
  },
  {
    name: "obsidian-deep",
    displayName: "Obsidian Deep",
    description: "Volcanic glass, dimmed, with muted gold",
    family: "Obsidian",
    swatches: ["#0e0e0e", "#141414", "#47695c", "#cc9650"],
  },
  {
    name: "obsidian-ember",
    displayName: "Obsidian Ember",
    description: "Volcanic glass with a lava signal",
    family: "Obsidian",
    swatches: ["#0e0e0e", "#141414", "#8a5640", "#f07a4e"],
  },
  {
    name: "obsidian-frost",
    displayName: "Obsidian Frost",
    description: "Volcanic glass with an ice signal",
    family: "Obsidian",
    swatches: ["#0e0e0e", "#141414", "#4a7598", "#9ccbf0"],
  },
  {
    name: "graphite",
    displayName: "Graphite",
    description: "Pencil lead with a highlighter signal",
    family: "Graphite",
    swatches: ["#4f555b", "#575d64", "#6d93ba", "#e8d25a"],
  },
  {
    name: "graphite-warm",
    displayName: "Graphite Warm",
    description: "Pencil lead with a brass signal",
    family: "Graphite",
    swatches: ["#4f555b", "#575d64", "#a88a60", "#e8b85a"],
  },
  {
    name: "graphite-dusk",
    displayName: "Graphite Dusk",
    description: "Pencil lead with a lilac signal",
    family: "Graphite",
    swatches: ["#4f555b", "#575d64", "#8c80c8", "#c9b5f7"],
  },
  {
    name: "graphite-ember",
    displayName: "Graphite Ember",
    description: "Graphite with a glowing ember signal",
    family: "Graphite",
    swatches: ["#4f555b", "#575d64", "#b07656", "#f7ac7e"],
  },
  {
    name: "basalt",
    displayName: "Basalt",
    description: "Cooled lava stone with a sulfur signal",
    family: "Basalt",
    swatches: ["#161718", "#1c1d1f", "#4a76a8", "#d9c84a"],
  },
  {
    name: "carbon",
    displayName: "Carbon",
    description: "Woven fibre with an electric cyan signal",
    family: "Carbon",
    swatches: ["#131416", "#191a1d", "#2f7f8f", "#4fd6e8"],
  },
];

const AppThemeNames: ReadonlySet<string> = new Set(
  AppThemes.map((theme) => theme.name)
);

/** Resolves a stored app theme, falling back to the default for removed or unknown themes. */
export function resolveAppTheme(theme: string | undefined): AppThemeName {
  return theme && AppThemeNames.has(theme)
    ? (theme as AppThemeName)
    : DefaultAppTheme;
}

/** Options page query parameter: create a new script for this URL pattern. */
export const NEW_SCRIPT_PATTERN_PARAM = "new-script-pattern";
