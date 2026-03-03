import { ThemeRegistration } from "@shikijs/core";

export const monokaiPro: ThemeRegistration = {
  name: "monokai-pro",
  displayName: "Monokai Pro",
  type: "dark",
  fg: "#fcfcfa",
  bg: "#2d2a2e",
  settings: [
    { settings: { foreground: "#fcfcfa", background: "#2d2a2e" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#ff6188" },
    },
    { scope: "keyword.control", settings: { foreground: "#ff6188" } },
    {
      scope: [
        "type",
        "entity.name.type",
        "support.type",
        "support.class",
        "entity.other.inherited-class",
      ],
      settings: { foreground: "#78dce8", fontStyle: "italic" },
    },
    {
      scope: ["type.identifier", "entity.name.type", "entity.name.class"],
      settings: { foreground: "#a9dc76" },
    },
    { scope: "string", settings: { foreground: "#ffd866" } },
    {
      scope: ["string.escape", "constant.character.escape"],
      settings: { foreground: "#ab9df2" },
    },
    { scope: "comment", settings: { foreground: "#727072", fontStyle: "italic" } },
    {
      scope: ["function", "entity.name.function", "support.function"],
      settings: { foreground: "#a9dc76" },
    },
    { scope: "variable", settings: { foreground: "#fcfcfa" } },
    { scope: "variable.parameter", settings: { foreground: "#fc9867", fontStyle: "italic" } },
    {
      scope: ["number", "constant.numeric"],
      settings: { foreground: "#ab9df2" },
    },
    { scope: "constant", settings: { foreground: "#ab9df2" } },
    {
      scope: ["operator", "keyword.operator"],
      settings: { foreground: "#ff6188" },
    },
    {
      scope: ["delimiter", "punctuation", "meta.brace"],
      settings: { foreground: "#939293" },
    },
    {
      scope: ["tag", "entity.name.tag"],
      settings: { foreground: "#ff6188" },
    },
    {
      scope: ["attribute.name", "entity.other.attribute-name"],
      settings: { foreground: "#78dce8" },
    },
    {
      scope: ["attribute.value", "support.constant.property-value"],
      settings: { foreground: "#ffd866" },
    },
  ],
  colors: {
    "editor.background": "#2d2a2e",
    "editor.foreground": "#fcfcfa",
    "editorLineNumber.foreground": "#5b595c",
    "editorLineNumber.activeForeground": "#c1c0c0",
    "editorCursor.foreground": "#fcfcfa",
    "editor.selectionBackground": "#5b595c80",
    "editor.inactiveSelectionBackground": "#5b595c40",
    "editorIndentGuide.background1": "#403e41",
    "editorIndentGuide.activeBackground1": "#5b595c",
    "editor.lineHighlightBackground": "#363337",
    "editorBracketMatch.background": "#5b595c80",
    "editorBracketMatch.border": "#ffd866",
  },
};
