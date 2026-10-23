import { CodeEditor } from "@/options/invert-ide/shared/CodeEditor";
import type { EditorThemeSetting } from "@shared/editor-theme";

type ThemePreviewProps = {
  theme: EditorThemeSetting;
};

export function ThemePreview({ theme }: ThemePreviewProps) {
  const PREVIEW_CODE = `
// Invert IDE — theme preview

const greet = (name: string): string => {
  const count = 42;
  const msg = \`Hello, \${name}!\`;
  return { msg, count };
};`;

  return (
    <div className="overflow-hidden rounded-default border border-border">
      <div className="flex items-center border-b border-border-subtle bg-surface-panel px-3 py-1.5 select-none">
        <span className="font-mono text-xs text-text-muted">preview.ts</span>
      </div>

      <div className="theme-preview--editor h-40 min-h-0">
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
