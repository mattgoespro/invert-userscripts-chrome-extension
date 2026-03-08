import { ThemeRegistration } from "@shikijs/core";

export const beardedVividBlack: ThemeRegistration = {
  name: "bearded-vivid-black",
  displayName: "Bearded Vivid Black",
  type: "dark",
  fg: "#d4d4d4",
  bg: "#121212",
  settings: [
    { settings: { foreground: "#d4d4d4", background: "#121212" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#ff79c6" },
    },
    { scope: "keyword.control", settings: { foreground: "#ff79c6" } },
    {
      scope: [
        "type",
        "entity.name.type",
        "support.type",
        "support.class",
        "entity.other.inherited-class",
      ],
      settings: { foreground: "#8be9fd" },
    },
    {
      scope: ["type.identifier", "entity.name.type", "entity.name.class"],
      settings: { foreground: "#50fa7b" },
    },
    { scope: "string", settings: { foreground: "#f1fa8c" } },
    {
      scope: ["string.escape", "constant.character.escape"],
      settings: { foreground: "#ffb86c" },
    },
    {
      scope: "comment",
      settings: { foreground: "#6272a4", fontStyle: "italic" },
    },
    {
      scope: ["function", "entity.name.function", "support.function"],
      settings: { foreground: "#50fa7b" },
    },
    { scope: "variable", settings: { foreground: "#ff6e6e" } },
    { scope: "variable.parameter", settings: { foreground: "#ffb86c" } },
    {
      scope: ["number", "constant.numeric"],
      settings: { foreground: "#bd93f9" },
    },
    { scope: "constant", settings: { foreground: "#bd93f9" } },
    {
      scope: ["operator", "keyword.operator"],
      settings: { foreground: "#ff79c6" },
    },
    {
      scope: ["delimiter", "punctuation", "meta.brace"],
      settings: { foreground: "#6272a4" },
    },
    {
      scope: ["tag", "entity.name.tag"],
      settings: { foreground: "#8be9fd" },
    },
    {
      scope: ["attribute.name", "entity.other.attribute-name"],
      settings: { foreground: "#50fa7b" },
    },
    {
      scope: ["attribute.value", "support.constant.property-value"],
      settings: { foreground: "#f1fa8c" },
    },
  ],
  colors: {
    "editor.background": "#121212",
    "editor.foreground": "#d4d4d4",
    "editorLineNumber.foreground": "#3b3b3b",
    "editorLineNumber.activeForeground": "#d4d4d4",
    "editorCursor.foreground": "#ff79c6",
    "editor.selectionBackground": "#6272a450",
    "editor.inactiveSelectionBackground": "#6272a430",
    "editorIndentGuide.background1": "#2a2a2a",
    "editorIndentGuide.activeBackground1": "#3b3b3b",
    "editor.lineHighlightBackground": "#1a1a1a",
    "editorBracketMatch.background": "#6272a450",
    "editorBracketMatch.border": "#50fa7b",
  },
};
