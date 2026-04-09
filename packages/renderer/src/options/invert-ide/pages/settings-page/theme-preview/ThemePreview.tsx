import { EditorThemeName } from "@packages/monaco";
import { CodeEditor } from "@/options/invert-ide/shared/CodeEditor";

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
    <div className="overflow-hidden rounded-default border border-border">
      <div className="flex items-center gap-2 border-b border-border-subtle bg-[rgba(30,30,30,0.9)] px-3 py-2 select-none">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] opacity-85" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e] opacity-85" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840] opacity-85" />
        </div>
        <span className="flex-1 text-center font-mono text-[0.6875rem] tracking-[0.02em] text-text-muted">
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
