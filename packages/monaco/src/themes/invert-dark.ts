import { ThemeRegistration } from "@shikijs/core";

export const invertDark: ThemeRegistration = {
  name: "invert-dark",
  displayName: "Invert Dark",
  type: "dark",
  fg: "#f0f0f0",
  bg: "#0a0a0c",
  settings: [
    { settings: { foreground: "#f0f0f0", background: "#0a0a0c" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#da70d6", fontStyle: "bold" },
    },
    { scope: "keyword.control", settings: { foreground: "#da70d6" } },
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
      settings: { foreground: "#ffba00" },
    },
    {
      scope: "comment",
      settings: { foreground: "#808080", fontStyle: "italic" },
    },
    {
      scope: ["function", "entity.name.function", "support.function"],
      settings: { foreground: "#dcdcaa" },
    },
    { scope: "variable", settings: { foreground: "#9cdcfe" } },
    { scope: "variable.parameter", settings: { foreground: "#9cdcfe" } },
    {
      scope: ["number", "constant.numeric"],
      settings: { foreground: "#b5cea8" },
    },
    { scope: "constant", settings: { foreground: "#569cd6" } },
    {
      scope: ["operator", "keyword.operator"],
      settings: { foreground: "#f0f0f0" },
    },
    {
      scope: ["delimiter", "punctuation", "meta.brace"],
      settings: { foreground: "#808080" },
    },
    {
      scope: ["tag", "entity.name.tag"],
      settings: { foreground: "#569cd6" },
    },
    {
      scope: ["attribute.name", "entity.other.attribute-name"],
      settings: { foreground: "#9cdcfe" },
    },
    {
      scope: ["attribute.value", "support.constant.property-value"],
      settings: { foreground: "#ce9178" },
    },
  ],
  colors: {
    "editor.background": "#0a0a0c",
    "editor.foreground": "#f0f0f0",
    "editorLineNumber.foreground": "#808080",
    "editorLineNumber.activeForeground": "#f0f0f0",
    "editorCursor.foreground": "#ffba00",
    "editor.selectionBackground": "#1868c466",
    "editor.inactiveSelectionBackground": "#1868c433",
    "editorIndentGuide.background1": "#2d2d2d",
    "editorIndentGuide.activeBackground1": "#808080",
    "editor.lineHighlightBackground": "#1e1e1e",
    "editorBracketMatch.background": "#1868c433",
    "editorBracketMatch.border": "#1868c4",
  },
};
