import { ThemeRegistration } from "@shikijs/core";

export const graphiteDusk: ThemeRegistration = {
  name: "graphite-dusk",
  displayName: "Graphite Dusk",
  type: "dark",
  fg: "#d2d0d6",
  bg: "#1e1d20",
  settings: [
    { settings: { foreground: "#d2d0d6", background: "#1e1d20" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#c586c0", fontStyle: "bold" },
    },
    { scope: "keyword.control", settings: { foreground: "#c586c0" } },
    {
      scope: [
        "type",
        "entity.name.type",
        "support.type",
        "support.class",
        "entity.other.inherited-class",
      ],
      settings: { foreground: "#4ec9b0" },
    },
    {
      scope: ["type.identifier", "entity.name.type", "entity.name.class"],
      settings: { foreground: "#4ec9b0" },
    },
    { scope: "string", settings: { foreground: "#ce9178" } },
    {
      scope: ["string.escape", "constant.character.escape"],
      settings: { foreground: "#d7ba7d" },
    },
    {
      scope: "comment",
      settings: { foreground: "#626068", fontStyle: "italic" },
    },
    {
      scope: ["function", "entity.name.function", "support.function"],
      settings: { foreground: "#dcdcaa" },
    },
    { scope: "variable", settings: { foreground: "#b8b4ea" } },
    { scope: "variable.parameter", settings: { foreground: "#b8b4ea" } },
    {
      scope: ["number", "constant.numeric"],
      settings: { foreground: "#b5cea8" },
    },
    { scope: "constant", settings: { foreground: "#a4a0e0" } },
    {
      scope: ["operator", "keyword.operator"],
      settings: { foreground: "#d2d0d6" },
    },
    {
      scope: ["delimiter", "punctuation", "meta.brace"],
      settings: { foreground: "#82808a" },
    },
    {
      scope: ["tag", "entity.name.tag"],
      settings: { foreground: "#a4a0e0" },
    },
    {
      scope: ["attribute.name", "entity.other.attribute-name"],
      settings: { foreground: "#b8b4ea" },
    },
    {
      scope: ["attribute.value", "support.constant.property-value"],
      settings: { foreground: "#ce9178" },
    },
  ],
  colors: {
    "editor.background": "#1e1d20",
    "editor.foreground": "#d2d0d6",
    "editorLineNumber.foreground": "#58545e",
    "editorLineNumber.activeForeground": "#d2d0d6",
    "editorCursor.foreground": "#a088c8",
    "editor.selectionBackground": "#a088c840",
    "editor.inactiveSelectionBackground": "#a088c825",
    "editorIndentGuide.background1": "#323036",
    "editorIndentGuide.activeBackground1": "#3c3a42",
    "editor.lineHighlightBackground": "#252428",
    "editorBracketMatch.background": "#a088c830",
    "editorBracketMatch.border": "#a088c8",
  },
};
