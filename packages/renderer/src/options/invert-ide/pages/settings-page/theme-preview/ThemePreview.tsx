import { EditorThemeName } from "@packages/monaco";
import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import "./ThemePreview.scss";
import prettier from "prettier/standalone";
import parserTypescript from "prettier/parser-typescript";

const _PREVIEW_CODE_FORMATTED = prettier.format(
  `// Invert IDE — theme preview
  class X {}
const greet = (name: string): string => {
  const count = 42;
  const msg = \`Hello, \${name}!\`;
  return { msg, count };
// };`,
  { parser: "typescript", plugins: [parserTypescript] }
);

const PREVIEW_CODE = `
// Invert IDE — theme preview

const greet = (name: string): string => {
  const count = 42;
  const msg = \`Hello, \${name}!\`;
  return { msg, count };
};`;

type ThemePreviewProps = {
  theme: EditorThemeName;
};

export function ThemePreview({ theme }: ThemePreviewProps) {
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

      <div className="theme-preview--editor">
        <CodeEditor
          modelId="theme-preview"
          contents={PREVIEW_CODE}
          language="typescript"
          editable={false}
          settingsOverride={{ theme, fontSize: 12 }}
        />
      </div>
    </div>
  );
}
