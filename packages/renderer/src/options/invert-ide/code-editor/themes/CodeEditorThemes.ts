import monaco from "monaco-editor";

export const EditorThemes: Record<string, monaco.editor.IStandaloneThemeData> = {
  "invert-ide-light": {
    base: "vs",
    inherit: true,
    rules: [
      { token: "", background: "F0F0F0", foreground: "000000" },
      { token: "keyword", foreground: "0000FF", fontStyle: "bold" },
      { token: "string", foreground: "A31515" },
      { token: "comment", foreground: "008000", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#F0F0F0",
      "editor.foreground": "#000000",
      "editorLineNumber.foreground": "#237893",
      "editorCursor.foreground": "#000000",
      "editor.selectionBackground": "#ADD6FF",
    },
  },
  "invert-ide-dark": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", background: "1E1E1E", foreground: "D4D4D4" },
      { token: "keyword", foreground: "569CD6", fontStyle: "bold" },
      { token: "string", foreground: "CE9178" },
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#1E1E1E",
      "editor.foreground": "#D4D4D4",
      "editorLineNumber.foreground": "#858585",
      "editorCursor.foreground": "#FFFFFF",
      "editor.selectionBackground": "#264F78",
    },
  },
  "material-theme-dark": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", background: "263238", foreground: "ECEFF1" },
      { token: "keyword", foreground: "C792EA", fontStyle: "bold" },
      { token: "string", foreground: "C3E88D" },
      { token: "comment", foreground: "546E7A", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#263238",
      "editor.foreground": "#ECEFF1",
      "editorLineNumber.foreground": "#546E7A",
      "editorCursor.foreground": "#FFFFFF",
      "editor.selectionBackground": "#37474F",
    },
  },
};

export function registerCodeEditorThemes() {
  for (const [themeName, themeData] of Object.entries(EditorThemes)) {
    monaco.editor.defineTheme(themeName, themeData);
  }
}
