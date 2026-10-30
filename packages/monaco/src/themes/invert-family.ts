import { ThemeRegistration } from "@shikijs/core";

/**
 * Colors for one editor theme in the Invert family. Each palette mirrors an app
 * theme's primitives (packages/renderer/src/assets/styles/base.css), so the code
 * editors read as part of the same surface instead of a separate dark panel.
 */
interface InvertEditorPalette {
  name: string;
  displayName: string;
  type: "dark";
  /** Editor surface; the app's `surface-base`. */
  background: string;
  /** Widgets, hovers and suggestions; the app's `surface-raised`. */
  raised: string;
  foreground: string;
  muted: string;
  faint: string;
  border: string;
  borderSubtle: string;
  /** The theme's signal color, used for the cursor and find matches. */
  accent: string;
  /** The theme's selection color. */
  selected: string;
  error: string;
  warning: string;
  info: string;
  syntax: {
    keyword: string;
    func: string;
    param: string;
    type: string;
    string: string;
    number: string;
    punctuation: string;
    comment: string;
  };
}

/** Appends a two-digit hex alpha to a #rrggbb color. */
function alpha(hex: string, opacity: number): string {
  const channel = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex.slice(0, 7)}${channel}`;
}

function createInvertEditorTheme(
  palette: InvertEditorPalette
): ThemeRegistration {
  const { syntax } = palette;

  return {
    name: palette.name,
    displayName: palette.displayName,
    type: palette.type,
    fg: palette.foreground,
    bg: palette.background,
    settings: [
      {
        settings: {
          foreground: palette.foreground,
          background: palette.background,
        },
      },
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: syntax.comment, fontStyle: "italic" },
      },
      {
        scope: [
          "keyword",
          "keyword.control",
          "storage",
          "storage.type",
          "storage.modifier",
          "keyword.other.important",
          "entity.name.tag",
          "keyword.control.at-rule",
          "punctuation.definition.keyword",
        ],
        settings: { foreground: syntax.keyword },
      },
      {
        scope: [
          "keyword.operator",
          "keyword.operator.type",
          "storage.type.function.arrow",
        ],
        settings: { foreground: syntax.punctuation },
      },
      {
        scope: [
          "keyword.operator.new",
          "keyword.operator.expression",
          "keyword.operator.logical",
        ],
        settings: { foreground: syntax.keyword },
      },
      {
        scope: [
          "entity.name.function",
          "support.function",
          "meta.function-call entity.name.function",
          "variable.function",
          "entity.other.attribute-name.id",
        ],
        settings: { foreground: syntax.func },
      },
      {
        scope: [
          "entity.name.type",
          "entity.name.class",
          "entity.name.interface",
          "entity.other.inherited-class",
          "support.type",
          "support.class",
          "entity.other.attribute-name.class",
          "entity.other.attribute-name.pseudo-class",
          "entity.other.attribute-name.pseudo-element",
        ],
        settings: { foreground: syntax.type },
      },
      {
        scope: [
          "variable.parameter",
          "variable.other.property",
          "variable.other.object.property",
          "meta.object-literal.key",
          "support.type.property-name",
          "support.variable.property",
          "variable.scss",
          "variable.css",
        ],
        settings: { foreground: syntax.param },
      },
      {
        scope: [
          "variable",
          "variable.other.readwrite",
          "meta.definition.variable",
        ],
        settings: { foreground: palette.foreground },
      },
      {
        scope: [
          "string",
          "string.template",
          "punctuation.definition.string",
          "support.constant.property-value",
          "string.unquoted",
        ],
        settings: { foreground: syntax.string },
      },
      {
        scope: [
          "constant.character.escape",
          "string.regexp",
          "punctuation.definition.template-expression",
          "punctuation.section.embedded",
        ],
        settings: { foreground: syntax.type },
      },
      {
        scope: [
          "constant.numeric",
          "constant.language",
          "keyword.other.unit",
          "support.constant",
          "variable.other.enummember",
          "constant.other.color",
        ],
        settings: { foreground: syntax.number },
      },
      {
        scope: [
          "punctuation",
          "meta.brace",
          "punctuation.separator",
          "punctuation.terminator",
          "punctuation.accessor",
        ],
        settings: { foreground: syntax.punctuation },
      },
      {
        scope: ["meta.decorator", "punctuation.decorator"],
        settings: { foreground: syntax.func, fontStyle: "italic" },
      },
      {
        scope: "invalid",
        settings: { foreground: palette.error },
      },
    ],
    colors: {
      "editor.background": palette.background,
      "editor.foreground": palette.foreground,
      "editorLineNumber.foreground": palette.faint,
      "editorLineNumber.activeForeground": palette.foreground,
      "editorCursor.foreground": palette.accent,
      "editor.lineHighlightBackground": alpha(palette.selected, 0.35),
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": alpha(palette.selected, 0.85),
      "editor.inactiveSelectionBackground": alpha(palette.selected, 0.45),
      "editor.selectionHighlightBackground": alpha(palette.selected, 0.5),
      "editor.wordHighlightBackground": alpha(palette.selected, 0.45),
      "editor.wordHighlightStrongBackground": alpha(palette.selected, 0.65),
      "editor.findMatchBackground": alpha(palette.accent, 0.45),
      "editor.findMatchHighlightBackground": alpha(palette.accent, 0.2),
      "editor.findMatchBorder": palette.accent,
      "editorIndentGuide.background1": palette.borderSubtle,
      "editorIndentGuide.activeBackground1": palette.border,
      "editorWhitespace.foreground": palette.borderSubtle,
      "editorBracketMatch.background": alpha(palette.selected, 0.6),
      "editorBracketMatch.border": alpha(palette.accent, 0.6),
      "editorBracketHighlight.foreground1": syntax.punctuation,
      "editorBracketHighlight.foreground2": syntax.keyword,
      "editorBracketHighlight.foreground3": syntax.func,
      "editorBracketHighlight.unexpectedBracket.foreground": palette.error,
      "editorGutter.background": palette.background,
      "editorError.foreground": palette.error,
      "editorWarning.foreground": palette.warning,
      "editorInfo.foreground": palette.info,
      "editorWidget.background": palette.raised,
      "editorWidget.foreground": palette.foreground,
      "editorWidget.border": palette.border,
      "editorHoverWidget.background": palette.raised,
      "editorHoverWidget.border": palette.border,
      "editorSuggestWidget.background": palette.raised,
      "editorSuggestWidget.border": palette.border,
      "editorSuggestWidget.foreground": palette.foreground,
      "editorSuggestWidget.highlightForeground": palette.accent,
      "editorSuggestWidget.selectedBackground": palette.selected,
      "editorSuggestWidget.selectedForeground": palette.foreground,
      "editorSuggestWidget.focusHighlightForeground": palette.accent,
      "list.hoverBackground": alpha(palette.selected, 0.5),
      "list.activeSelectionBackground": palette.selected,
      "list.activeSelectionForeground": palette.foreground,
      "list.highlightForeground": palette.accent,
      "quickInput.background": palette.raised,
      "input.background": palette.background,
      "input.border": palette.border,
      focusBorder: alpha(palette.accent, 0.6),
      "widget.shadow": "#00000080",
      "scrollbarSlider.background": alpha(palette.border, 0.6),
      "scrollbarSlider.hoverBackground": palette.border,
      "scrollbarSlider.activeBackground": palette.faint,
      "editorOverviewRuler.border": "#00000000",
      "editorCodeLens.foreground": palette.muted,
      "editorLink.activeForeground": palette.accent,
      "editorGhostText.foreground": palette.faint,
    },
  };
}

export const invertGraphite = createInvertEditorTheme({
  name: "invert-graphite",
  displayName: "Graphite",
  type: "dark",
  background: "#4f555b",
  raised: "#575d64",
  foreground: "#f2f3f5",
  muted: "#d0d3d7",
  faint: "#a6abb1",
  border: "#383d42",
  borderSubtle: "#464b51",
  accent: "#e8d25a",
  selected: "#3d4e61",
  error: "#ffb0a3",
  warning: "#f5cf75",
  info: "#b5d2ee",
  syntax: {
    keyword: "#e2c0f0",
    func: "#f0e8a8",
    param: "#b8e6ff",
    type: "#8ee6d0",
    string: "#f2bea3",
    number: "#d3e8c2",
    punctuation: "#c2c6cb",
    comment: "#b0c0a8",
  },
});

export const invertGraphiteWarm = createInvertEditorTheme({
  name: "invert-graphite-warm",
  displayName: "Graphite Warm",
  type: "dark",
  background: "#4f555b",
  raised: "#575d64",
  foreground: "#f2f3f5",
  muted: "#d0d3d7",
  faint: "#a6abb1",
  border: "#383d42",
  borderSubtle: "#464b51",
  accent: "#e8b85a",
  selected: "#5c4f3f",
  error: "#ffb0a3",
  warning: "#f5cf75",
  info: "#c4dcea",
  syntax: {
    keyword: "#f0bcd4",
    func: "#f2d394",
    param: "#c4dcea",
    type: "#a8dcc0",
    string: "#d8e0a4",
    number: "#f2bc9c",
    punctuation: "#c2c6cb",
    comment: "#c0b6a8",
  },
});

export const invertGraphiteDusk = createInvertEditorTheme({
  name: "invert-graphite-dusk",
  displayName: "Graphite Dusk",
  type: "dark",
  background: "#4f555b",
  raised: "#575d64",
  foreground: "#f2f3f5",
  muted: "#d0d3d7",
  faint: "#a6abb1",
  border: "#383d42",
  borderSubtle: "#464b51",
  accent: "#c9b5f7",
  selected: "#4e4870",
  error: "#ffb0a3",
  warning: "#f5cf75",
  info: "#c4cdf7",
  syntax: {
    keyword: "#f0bdeb",
    func: "#f5d9a3",
    param: "#d0cdf5",
    type: "#9ee5d8",
    string: "#c0eac0",
    number: "#f7c2d4",
    punctuation: "#c2c6cb",
    comment: "#b9b5d0",
  },
});

export const invertGraphiteEmber = createInvertEditorTheme({
  name: "invert-graphite-ember",
  displayName: "Graphite Ember",
  type: "dark",
  background: "#4f555b",
  raised: "#575d64",
  foreground: "#f2f3f5",
  muted: "#d0d3d7",
  faint: "#a6abb1",
  border: "#383d42",
  borderSubtle: "#464b51",
  accent: "#f7ac7e",
  selected: "#5e4a40",
  error: "#ffb0a3",
  warning: "#f5cf75",
  info: "#ccd8e4",
  syntax: {
    keyword: "#ecbde6",
    func: "#f7bd97",
    param: "#cfe0ec",
    type: "#a8dcc8",
    string: "#cfe6a8",
    number: "#f5d29c",
    punctuation: "#c2c6cb",
    comment: "#c0b4ae",
  },
});

export const invertObsidian = createInvertEditorTheme({
  name: "invert-obsidian",
  displayName: "Obsidian",
  type: "dark",
  background: "#0e0e0e",
  raised: "#141414",
  foreground: "#cdd3cf",
  muted: "#9aa39e",
  faint: "#66706b",
  border: "#262626",
  borderSubtle: "#1c1c1c",
  accent: "#e2a555",
  selected: "#24302b",
  error: "#ea8080",
  warning: "#e8c15a",
  info: "#8fc2c8",
  syntax: {
    keyword: "#c792ea",
    func: "#e2c08d",
    param: "#89ddff",
    type: "#73c991",
    string: "#c3e88d",
    number: "#f78c6c",
    punctuation: "#828b86",
    comment: "#66706b",
  },
});

export const invertObsidianDeep = createInvertEditorTheme({
  name: "invert-obsidian-deep",
  displayName: "Obsidian Deep",
  type: "dark",
  background: "#0e0e0e",
  raised: "#141414",
  foreground: "#c2c8c5",
  muted: "#8f9894",
  faint: "#5e6763",
  border: "#262626",
  borderSubtle: "#1c1c1c",
  accent: "#cc9650",
  selected: "#1e2826",
  error: "#e07a7a",
  warning: "#d9b556",
  info: "#86b3b8",
  syntax: {
    keyword: "#b888d8",
    func: "#d8b47e",
    param: "#80c8e8",
    type: "#68b580",
    string: "#a8c97a",
    number: "#d88a6a",
    punctuation: "#7a837f",
    comment: "#5e6763",
  },
});

export const invertObsidianEmber = createInvertEditorTheme({
  name: "invert-obsidian-ember",
  displayName: "Obsidian Ember",
  type: "dark",
  background: "#0e0e0e",
  raised: "#141414",
  foreground: "#d3c8c3",
  muted: "#a39590",
  faint: "#6e625d",
  border: "#262626",
  borderSubtle: "#1c1c1c",
  accent: "#f07a4e",
  selected: "#33251f",
  error: "#f2808e",
  warning: "#e8bc5a",
  info: "#c0c8d0",
  syntax: {
    keyword: "#c792ea",
    func: "#f0a07e",
    param: "#f2c38f",
    type: "#78b0a0",
    string: "#c8d890",
    number: "#f0b070",
    punctuation: "#8a7d78",
    comment: "#6e625d",
  },
});

export const invertObsidianFrost = createInvertEditorTheme({
  name: "invert-obsidian-frost",
  displayName: "Obsidian Frost",
  type: "dark",
  background: "#0e0e0e",
  raised: "#141414",
  foreground: "#cbd3da",
  muted: "#97a3ae",
  faint: "#63707b",
  border: "#262626",
  borderSubtle: "#1c1c1c",
  accent: "#9ccbf0",
  selected: "#1f2d3a",
  error: "#ec8a92",
  warning: "#e5c46b",
  info: "#a8c4da",
  syntax: {
    keyword: "#b898d8",
    func: "#9ccbf0",
    param: "#a0d4e8",
    type: "#70b890",
    string: "#a8d8b0",
    number: "#e8b0a0",
    punctuation: "#7e8a95",
    comment: "#63707b",
  },
});

export const invertMatteGrey = createInvertEditorTheme({
  name: "invert-matte-grey",
  displayName: "Matte Grey",
  type: "dark",
  background: "#1c1c1c",
  raised: "#222222",
  foreground: "#dadada",
  muted: "#a6a6a6",
  faint: "#727272",
  border: "#333333",
  borderSubtle: "#262626",
  accent: "#e0a85a",
  selected: "#1f2a38",
  error: "#f08a80",
  warning: "#e6c65c",
  info: "#a7c4dd",
  syntax: {
    keyword: "#b4a7d6",
    func: "#d9c99a",
    param: "#a7c4dd",
    type: "#92c7b5",
    string: "#c9b28f",
    number: "#c3d4a0",
    punctuation: "#8f8f8f",
    comment: "#737373",
  },
});

export const invertBasalt = createInvertEditorTheme({
  name: "invert-basalt",
  displayName: "Basalt",
  type: "dark",
  background: "#161718",
  raised: "#1c1d1f",
  foreground: "#d6dade",
  muted: "#a0a7af",
  faint: "#6f767e",
  border: "#2e3032",
  borderSubtle: "#222325",
  accent: "#d9c84a",
  selected: "#1e2b3c",
  error: "#f28a7e",
  warning: "#e8b34a",
  info: "#9cc0dc",
  syntax: {
    keyword: "#c6a4e0",
    func: "#e2d48c",
    param: "#9cc9e6",
    type: "#7fcbb4",
    string: "#c9a98a",
    number: "#b6d39a",
    punctuation: "#8a9199",
    comment: "#717d70",
  },
});

export const invertCarbon = createInvertEditorTheme({
  name: "invert-carbon",
  displayName: "Carbon",
  type: "dark",
  background: "#131416",
  raised: "#191a1d",
  foreground: "#dcdee2",
  muted: "#a2a6ad",
  faint: "#6e727a",
  border: "#2b2d31",
  borderSubtle: "#1f2124",
  accent: "#4fd6e8",
  selected: "#1d2f36",
  error: "#ff8a94",
  warning: "#f0c04f",
  info: "#8fd8e3",
  syntax: {
    keyword: "#a9a6ff",
    func: "#6fe0f0",
    param: "#b6c8e8",
    type: "#7fe0b8",
    string: "#e8c27a",
    number: "#ff9ec4",
    punctuation: "#8b8f96",
    comment: "#6e727a",
  },
});
