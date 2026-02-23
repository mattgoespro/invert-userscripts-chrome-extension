import { ThemeRegistration } from "@shikijs/core";

export const beardedArc: ThemeRegistration = {
  name: "bearded-arc",
  displayName: "Bearded Arc",
  type: "dark",
  fg: "#8196b5",
  bg: "#1c2433",
  settings: [
    { settings: { foreground: "#8196b5", background: "#1c2433" } },
    {
      scope: ["keyword", "storage", "storage.type", "storage.modifier"],
      settings: { foreground: "#eacd61" },
    },
    { scope: "keyword.control", settings: { foreground: "#eacd61" } },
    {
      scope: [
        "type",
        "entity.name.type",
        "support.type",
        "support.class",
        "entity.other.inherited-class",
      ],
      settings: { foreground: "#b78aff" },
    },
    {
      scope: ["type.identifier", "entity.name.type", "entity.name.class"],
      settings: { foreground: "#a4ef58" },
    },
    { scope: "string", settings: { foreground: "#3cec85" } },
    {
      scope: ["string.escape", "constant.character.escape"],
      settings: { foreground: "#ff955c" },
    },
    { scope: "comment", settings: { foreground: "#4a5567", fontStyle: "italic" } },
    {
      scope: ["function", "entity.name.function", "support.function"],
      settings: { foreground: "#69c3ff" },
    },
    { scope: "variable", settings: { foreground: "#ff738a" } },
    { scope: "variable.parameter", settings: { foreground: "#f38cec" } },
    {
      scope: ["number", "constant.numeric"],
      settings: { foreground: "#e35535" },
    },
    { scope: "constant", settings: { foreground: "#e35535" } },
    {
      scope: ["operator", "keyword.operator"],
      settings: { foreground: "#eacd61" },
    },
    {
      scope: ["delimiter", "punctuation", "meta.brace"],
      settings: { foreground: "#5a6a80" },
    },
    {
      scope: ["tag", "entity.name.tag"],
      settings: { foreground: "#69c3ff" },
    },
    {
      scope: ["attribute.name", "entity.other.attribute-name"],
      settings: { foreground: "#eacd61" },
    },
    {
      scope: ["attribute.value", "support.constant.property-value"],
      settings: { foreground: "#3cec85" },
    },
  ],
  colors: {
    "editor.background": "#1c2433",
    "editor.foreground": "#8196b5",
    "editorLineNumber.foreground": "#3b4858",
    "editorLineNumber.activeForeground": "#8196b5",
    "editorCursor.foreground": "#eacd61",
    "editor.selectionBackground": "#8196b530",
    "editor.inactiveSelectionBackground": "#8196b520",
    "editorIndentGuide.background1": "#2a3545",
    "editorIndentGuide.activeBackground1": "#3b4858",
    "editor.lineHighlightBackground": "#1f2838",
    "editorBracketMatch.background": "#8196b530",
    "editorBracketMatch.border": "#eacd61",
  },
};
