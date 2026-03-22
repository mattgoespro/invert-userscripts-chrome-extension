import { EditorThemeName } from "@packages/monaco";
import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";

type ThemePreviewProps = {
  theme: EditorThemeName;
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
    <div className="rounded-default overflow-hidden border border-border">
      <div className="flex items-center gap-2 py-2 px-3 bg-[rgba(30,30,30,0.9)] border-b border-border-subtle select-none">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full opacity-85 bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full opacity-85 bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full opacity-85 bg-[#28c840]" />
        </div>
        <span className="flex-1 text-center font-mono text-[0.6875rem] text-text-muted tracking-[0.02em]">
          preview.ts
        </span>
        <span className="w-11" />
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
