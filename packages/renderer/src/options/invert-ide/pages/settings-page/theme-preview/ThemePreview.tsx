import { EditorThemeName } from "@packages/monaco";
import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import "./ThemePreview.scss";

const PREVIEW_CODE = `// Invert IDE — theme preview
/**
 *
class Greeter {
    private greeting: string;

    constructor(message: string) {
        this.greeting = message;
    }

    public greet(): string {
        return "Hello, " + this.greeting;
    }
}

/**
 * Greets the user with a welcome message.
 * @param name - The name of the user to greet.
 * @returns A greeting message string.
 */
export function greet(name: string): string {
    const greeter = new Greeter(name);
    return greeter.greet();
}

// Example usage
greet("Invert IDE User");
`;

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
