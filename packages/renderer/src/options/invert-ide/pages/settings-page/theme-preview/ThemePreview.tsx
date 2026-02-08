import { CodeEditorThemeName, EditorThemes } from "@/shared/components/CodeEditorThemes";
import { useMemo } from "react";
import "./ThemePreview.scss";

type ThemePreviewProps = {
  theme: CodeEditorThemeName;
};

type TokenColorMap = {
  keyword: string;
  type: string;
  string: string;
  comment: string;
  function: string;
  variable: string;
  number: string;
  constant: string;
  operator: string;
  delimiter: string;
  foreground: string;
};

function extractTokenColors(theme: CodeEditorThemeName): TokenColorMap {
  const def = EditorThemes[theme]?.definition;
  if (!def) {
    return {
      keyword: "#da70d6",
      type: "#4ec9b0",
      string: "#ce9178",
      comment: "#808080",
      function: "#dcdcaa",
      variable: "#9cdcfe",
      number: "#b5cea8",
      constant: "#569cd6",
      operator: "#f0f0f0",
      delimiter: "#808080",
      foreground: "#f0f0f0",
    };
  }

  const colorMap: Record<string, string> = {};
  for (const rule of def.rules) {
    if (rule.token && rule.foreground) {
      colorMap[rule.token] = `#${rule.foreground}`;
    }
  }

  const fg = def.colors["editor.foreground"] ?? "#f0f0f0";

  return {
    keyword: colorMap["keyword"] ?? fg,
    type: colorMap["type"] ?? colorMap["type.identifier"] ?? fg,
    string: colorMap["string"] ?? fg,
    comment: colorMap["comment"] ?? "#808080",
    function: colorMap["function"] ?? fg,
    variable: colorMap["variable"] ?? colorMap["variable.parameter"] ?? fg,
    number: colorMap["number"] ?? fg,
    constant: colorMap["constant"] ?? fg,
    operator: colorMap["operator"] ?? fg,
    delimiter: colorMap["delimiter"] ?? "#808080",
    foreground: fg,
  };
}

type Token = { text: string; color: string };

function buildPreviewLines(colors: TokenColorMap): Token[][] {
  return [
    [{ text: "// Invert IDE — theme preview", color: colors.comment }],
    [
      { text: "const", color: colors.keyword },
      { text: " greet", color: colors.function },
      { text: " = ", color: colors.operator },
      { text: "(", color: colors.delimiter },
      { text: "name", color: colors.variable },
      { text: ": ", color: colors.delimiter },
      { text: "string", color: colors.type },
      { text: ")", color: colors.delimiter },
      { text: ": ", color: colors.delimiter },
      { text: "string", color: colors.type },
      { text: " =>", color: colors.operator },
      { text: " {", color: colors.delimiter },
    ],
    [
      { text: "  const", color: colors.keyword },
      { text: " count", color: colors.variable },
      { text: " = ", color: colors.operator },
      { text: "42", color: colors.number },
      { text: ";", color: colors.delimiter },
    ],
    [
      { text: "  const", color: colors.keyword },
      { text: " msg", color: colors.variable },
      { text: " = ", color: colors.operator },
      { text: "`Hello, ", color: colors.string },
      { text: "${", color: colors.keyword },
      { text: "name", color: colors.variable },
      { text: "}", color: colors.keyword },
      { text: "!`", color: colors.string },
      { text: ";", color: colors.delimiter },
    ],
    [
      { text: "  return", color: colors.keyword },
      { text: " { msg, count }", color: colors.variable },
      { text: ";", color: colors.delimiter },
    ],
    [
      { text: "}", color: colors.delimiter },
      { text: ";", color: colors.delimiter },
    ],
  ];
}

export function ThemePreview({ theme }: ThemePreviewProps) {
  const def = EditorThemes[theme]?.definition;
  const bg = def?.colors["editor.background"] ?? "#0a0a0c";
  const lineNumColor = def?.colors["editorLineNumber.foreground"] ?? "#808080";
  const lineHighlight = def?.colors["editor.lineHighlightBackground"] ?? "transparent";
  const cursorColor = def?.colors["editorCursor.foreground"] ?? "#f0f0f0";

  const colors = useMemo(() => extractTokenColors(theme), [theme]);
  const lines = useMemo(() => buildPreviewLines(colors), [colors]);

  return (
    <div className="theme-preview">
      <div className="theme-preview--titlebar">
        <div className="theme-preview--dots">
          <span className="theme-preview--dot theme-preview--dot-close" />
          <span className="theme-preview--dot theme-preview--dot-minimize" />
          <span className="theme-preview--dot theme-preview--dot-maximize" />
        </div>
        <span className="theme-preview--filename">preview.ts</span>
        <span className="theme-preview--spacer" />
      </div>

      <div className="theme-preview--editor" style={{ backgroundColor: bg }}>
        {lines.map((tokens, lineIdx) => (
          <div
            key={lineIdx}
            className="theme-preview--line"
            style={lineIdx === 1 ? { backgroundColor: lineHighlight } : undefined}
          >
            <span className="theme-preview--gutter" style={{ color: lineNumColor }}>
              {lineIdx + 1}
            </span>
            <span className="theme-preview--code">
              {lineIdx === 1 && (
                <span className="theme-preview--cursor" style={{ borderColor: cursorColor }} />
              )}
              {tokens.map((token, tokenIdx) => (
                <span key={tokenIdx} style={{ color: token.color }}>
                  {token.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
