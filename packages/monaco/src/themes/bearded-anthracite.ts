import { ThemeRegistration } from "@shikijs/core";

export const beardedAnthracite: ThemeRegistration = {
  name: "bearded-anthracite",
  displayName: "Bearded Anthracite",
  type: "dark",
  fg: "#a2abb6",
  bg: "#181a1f",
  settings: [
    { settings: { foreground: "#a2abb6", background: "#181a1f" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#c9a022" },
    },
    { scope: "keyword.control", settings: { foreground: "#c9a022" } },
    {
      scope: [
        "type",
        "entity.name.type",
        "support.type",
        "support.class",
        "entity.other.inherited-class",
      ],
      settings: { foreground: "#935cd1" },
    },
    {
      scope: ["type.identifier", "entity.name.type", "entity.name.class"],
      settings: { foreground: "#7e9e2d" },
    },
    { scope: "string", settings: { foreground: "#37ae6f" } },
    {
      scope: ["string.escape", "constant.character.escape"],
      settings: { foreground: "#d26d32" },
    },
    {
      scope: "comment",
      settings: { foreground: "#505860", fontStyle: "italic" },
    },
    {
      scope: ["function", "entity.name.function", "support.function"],
      settings: { foreground: "#3398db" },
    },
    { scope: "variable", settings: { foreground: "#de456b" } },
    { scope: "variable.parameter", settings: { foreground: "#cc71bc" } },
    {
      scope: ["number", "constant.numeric"],
      settings: { foreground: "#c13838" },
    },
    { scope: "constant", settings: { foreground: "#c13838" } },
    {
      scope: ["operator", "keyword.operator"],
      settings: { foreground: "#c9a022" },
    },
    {
      scope: ["delimiter", "punctuation", "meta.brace"],
      settings: { foreground: "#6a727d" },
    },
    {
      scope: ["tag", "entity.name.tag"],
      settings: { foreground: "#3398db" },
    },
    {
      scope: ["attribute.name", "entity.other.attribute-name"],
      settings: { foreground: "#c9a022" },
    },
    {
      scope: ["attribute.value", "support.constant.property-value"],
      settings: { foreground: "#37ae6f" },
    },
  ],
  colors: {
    "editor.background": "#181a1f",
    "editor.foreground": "#a2abb6",
    "editorLineNumber.foreground": "#3b4048",
    "editorLineNumber.activeForeground": "#a2abb6",
    "editorCursor.foreground": "#c9a022",
    "editor.selectionBackground": "#a2abb630",
    "editor.inactiveSelectionBackground": "#a2abb620",
    "editorIndentGuide.background1": "#252830",
    "editorIndentGuide.activeBackground1": "#3b4048",
    "editor.lineHighlightBackground": "#1d2025",
    "editorBracketMatch.background": "#a2abb630",
    "editorBracketMatch.border": "#c9a022",
  },
};
