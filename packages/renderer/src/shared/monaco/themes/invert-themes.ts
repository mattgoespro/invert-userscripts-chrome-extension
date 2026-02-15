import { MonacoTheme } from "@shikijs/monaco";

// ===========================================================================
// Invert IDE App Themes
// ===========================================================================

export default {
  "invert-dark": {
    displayName: "Invert Dark",
    theme: {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", background: "0a0a0c", foreground: "f0f0f0" },
        { token: "keyword", foreground: "da70d6", fontStyle: "bold" },
        { token: "keyword.control", foreground: "da70d6" },
        { token: "type", foreground: "4ec9b0" },
        { token: "type.identifier", foreground: "4ec9b0" },
        { token: "string", foreground: "ce9178" },
        { token: "string.escape", foreground: "ffba00" },
        { token: "comment", foreground: "808080", fontStyle: "italic" },
        { token: "function", foreground: "dcdcaa" },
        { token: "variable", foreground: "9cdcfe" },
        { token: "variable.parameter", foreground: "9cdcfe" },
        { token: "number", foreground: "b5cea8" },
        { token: "constant", foreground: "569cd6" },
        { token: "operator", foreground: "f0f0f0" },
        { token: "delimiter", foreground: "808080" },
        { token: "tag", foreground: "569cd6" },
        { token: "attribute.name", foreground: "9cdcfe" },
        { token: "attribute.value", foreground: "ce9178" },
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
    },
  },
} satisfies Record<string, { displayName: string; theme: MonacoTheme }>;
