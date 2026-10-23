import { ThemeRegistration } from "@shikijs/core";

/**
 * Colors for one editor theme in the Invert family. Each palette mirrors an app
 * theme's primitives (packages/renderer/src/assets/styles/base.css), so the code
 * editors read as part of the same surface instead of a separate dark panel.
 */
interface InvertEditorPalette {
  name: string;
  displayName: string;
  type: "dark" | "light";
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
  const isLight = palette.type === "light";

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
      "editor.selectionBackground": alpha(
        palette.selected,
        isLight ? 0.9 : 0.85
      ),
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
      "widget.shadow": isLight ? "#0e1b2a29" : "#00000080",
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

export const invertCyanotype = createInvertEditorTheme({
  name: "invert-cyanotype",
  displayName: "Cyanotype",
  type: "dark",
  background: "#0e1b2a",
  raised: "#102235",
  foreground: "#e4ecf2",
  muted: "#a9bccd",
  faint: "#6a86a0",
  border: "#1f3b56",
  borderSubtle: "#18304a",
  accent: "#f2a541",
  selected: "#1d3d5c",
  error: "#ff8a7a",
  warning: "#f2c14e",
  info: "#8fd3ff",
  syntax: {
    keyword: "#c3a6ff",
    func: "#8fd3ff",
    param: "#b9d9f2",
    type: "#f6d58e",
    string: "#a8e6c6",
    number: "#ffb8a0",
    punctuation: "#8fa6bc",
    comment: "#6a86a0",
  },
});

export const invertPrint = createInvertEditorTheme({
  name: "invert-print",
  displayName: "Print",
  type: "light",
  background: "#f4f7f9",
  raised: "#e9eff3",
  foreground: "#0e1b2a",
  muted: "#3a5068",
  faint: "#7d93a8",
  border: "#c5d3de",
  borderSubtle: "#dce5eb",
  accent: "#b8650a",
  selected: "#cfe0ee",
  error: "#c2412f",
  warning: "#8f5d00",
  info: "#1f5f9e",
  syntax: {
    keyword: "#7a3ec8",
    func: "#1f5f9e",
    param: "#255e86",
    type: "#8f5d00",
    string: "#1d7a55",
    number: "#a8460f",
    punctuation: "#587390",
    comment: "#6b8094",
  },
});

export const invertGraphite = createInvertEditorTheme({
  name: "invert-graphite",
  displayName: "Graphite",
  type: "dark",
  background: "#1c1d20",
  raised: "#222327",
  foreground: "#d8dadf",
  muted: "#a3a7ae",
  faint: "#70747c",
  border: "#34363c",
  borderSubtle: "#2b2d32",
  accent: "#e8d25a",
  selected: "#2e3a48",
  error: "#f48771",
  warning: "#e8b04a",
  info: "#8fb4d9",
  syntax: {
    keyword: "#c9a0dc",
    func: "#dcdcaa",
    param: "#9cdcfe",
    type: "#4ec9b0",
    string: "#ce9178",
    number: "#b5cea8",
    punctuation: "#8c9099",
    comment: "#7a8a74",
  },
});

export const invertGraphiteWarm = createInvertEditorTheme({
  name: "invert-graphite-warm",
  displayName: "Graphite Warm",
  type: "dark",
  background: "#1f1d1b",
  raised: "#262321",
  foreground: "#ddd6ce",
  muted: "#aba298",
  faint: "#776f66",
  border: "#3a3632",
  borderSubtle: "#302c29",
  accent: "#d9a441",
  selected: "#3b342c",
  error: "#e8866f",
  warning: "#e3b754",
  info: "#a9c7d8",
  syntax: {
    keyword: "#d49bb5",
    func: "#e3c07a",
    param: "#a9c7d8",
    type: "#8fc4a8",
    string: "#bfc98a",
    number: "#e0a07e",
    punctuation: "#948b81",
    comment: "#7c7468",
  },
});

export const invertGraphiteDusk = createInvertEditorTheme({
  name: "invert-graphite-dusk",
  displayName: "Graphite Dusk",
  type: "dark",
  background: "#1d1c22",
  raised: "#24232b",
  foreground: "#dad8e3",
  muted: "#a7a3b8",
  faint: "#736f86",
  border: "#38364a",
  borderSubtle: "#2e2d3c",
  accent: "#b69cf2",
  selected: "#34304a",
  error: "#f08a9a",
  warning: "#e8c06a",
  info: "#a9b6f0",
  syntax: {
    keyword: "#e09edb",
    func: "#f0c987",
    param: "#b8b4ea",
    type: "#7fd1c2",
    string: "#a8d8a8",
    number: "#f0a8c0",
    punctuation: "#8f8ba1",
    comment: "#757189",
  },
});

export const invertGraphiteEmber = createInvertEditorTheme({
  name: "invert-graphite-ember",
  displayName: "Graphite Ember",
  type: "dark",
  background: "#1d1c1c",
  raised: "#242222",
  foreground: "#dcd7d4",
  muted: "#a9a19d",
  faint: "#756d69",
  border: "#393433",
  borderSubtle: "#2f2b2a",
  accent: "#f08a4b",
  selected: "#3a302c",
  error: "#f2808e",
  warning: "#e8be55",
  info: "#b8c8d8",
  syntax: {
    keyword: "#d6a0d0",
    func: "#f0a678",
    param: "#b8d0e0",
    type: "#8fc8b0",
    string: "#b8d48a",
    number: "#f0c080",
    punctuation: "#918985",
    comment: "#7a706b",
  },
});

export const invertObsidian = createInvertEditorTheme({
  name: "invert-obsidian",
  displayName: "Obsidian",
  type: "dark",
  background: "#121413",
  raised: "#181b1a",
  foreground: "#cdd3cf",
  muted: "#9aa39e",
  faint: "#66706b",
  border: "#2a2f2d",
  borderSubtle: "#212624",
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
  background: "#0c0d0d",
  raised: "#121414",
  foreground: "#c2c8c5",
  muted: "#8f9894",
  faint: "#5e6763",
  border: "#232727",
  borderSubtle: "#1a1d1d",
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
  background: "#151110",
  raised: "#1c1716",
  foreground: "#d3c8c3",
  muted: "#a39590",
  faint: "#6e625d",
  border: "#352b28",
  borderSubtle: "#2a2220",
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
  background: "#111518",
  raised: "#171c20",
  foreground: "#cbd3da",
  muted: "#97a3ae",
  faint: "#63707b",
  border: "#2a3239",
  borderSubtle: "#20272d",
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
