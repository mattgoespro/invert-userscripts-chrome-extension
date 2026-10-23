import { AppThemeName } from "./model";

export type AppThemeFamily = "Cyanotype" | "Graphite" | "Obsidian";

export interface AppThemeDefinition {
  name: AppThemeName;
  displayName: string;
  description: string;
  family: AppThemeFamily;
  /** Representative colors for theme pickers: chrome, raised surface, selection, accent. */
  swatches: [string, string, string, string];
}

export const DefaultAppTheme: AppThemeName = "cyanotype";

export const AppThemes: AppThemeDefinition[] = [
  {
    name: "cyanotype",
    displayName: "Cyanotype",
    description: "Prussian blue with an amber signal",
    family: "Cyanotype",
    swatches: ["#0e1b2a", "#102235", "#3d7ab0", "#f2a541"],
  },
  {
    name: "print",
    displayName: "Print",
    description: "The light inverse of Cyanotype",
    family: "Cyanotype",
    swatches: ["#f4f7f9", "#e9eff3", "#2f6a9e", "#b8650a"],
  },
  {
    name: "graphite",
    displayName: "Graphite",
    description: "Pencil lead with a highlighter signal",
    family: "Graphite",
    swatches: ["#1c1d20", "#222327", "#5c7fa3", "#e8d25a"],
  },
  {
    name: "graphite-warm",
    displayName: "Graphite Warm",
    description: "Kraft paper with a brass signal",
    family: "Graphite",
    swatches: ["#1f1d1b", "#262321", "#8c7350", "#d9a441"],
  },
  {
    name: "graphite-dusk",
    displayName: "Graphite Dusk",
    description: "Violet dusk with a lilac signal",
    family: "Graphite",
    swatches: ["#1d1c22", "#24232b", "#7466b0", "#b69cf2"],
  },
  {
    name: "graphite-ember",
    displayName: "Graphite Ember",
    description: "Graphite with a glowing ember signal",
    family: "Graphite",
    swatches: ["#1d1c1c", "#242222", "#8f5e44", "#f08a4b"],
  },
  {
    name: "obsidian",
    displayName: "Obsidian",
    description: "Volcanic glass with a molten gold signal",
    family: "Obsidian",
    swatches: ["#121413", "#181b1a", "#4e7a66", "#e2a555"],
  },
  {
    name: "obsidian-deep",
    displayName: "Obsidian Deep",
    description: "The darkest glass, muted gold",
    family: "Obsidian",
    swatches: ["#0c0d0d", "#121414", "#47695c", "#cc9650"],
  },
  {
    name: "obsidian-ember",
    displayName: "Obsidian Ember",
    description: "Brown-black glass with a lava signal",
    family: "Obsidian",
    swatches: ["#151110", "#1c1716", "#8a5640", "#f07a4e"],
  },
  {
    name: "obsidian-frost",
    displayName: "Obsidian Frost",
    description: "Blue-black glass with an ice signal",
    family: "Obsidian",
    swatches: ["#111518", "#171c20", "#4a7598", "#9ccbf0"],
  },
];

/** Options page query parameter: create a new script for this URL pattern. */
export const NEW_SCRIPT_PATTERN_PARAM = "new-script-pattern";
