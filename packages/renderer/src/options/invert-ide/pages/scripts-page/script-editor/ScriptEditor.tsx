import { CodeEditor } from "@/options/invert-ide/code-editor/CodeEditor";
import { Userscript } from "@shared/model";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import "./ScriptEditor.scss";

type ScriptEditorProps = {
  script: Userscript;
  onSave: (language: "typescript" | "scss", code: string) => Promise<void>;
};

export function ScriptEditor({ script, onSave }: ScriptEditorProps) {
  return (
    <div className="script-editor--editor-area">
      <div className="script-editor--editor-header">
        <ScriptMetadata script={script} />
      </div>
      <div className="script-editor--editor-container">
        <div className="script-editor--code-editor">
          <CodeEditor
            key={script.id}
            language="typescript"
            contents={script.code.script}
            onSave={(code) => onSave("typescript", code)}
          />
        </div>
        <div className="script-editor--code-editor">
          <CodeEditor
            language="scss"
            contents={script.code.stylesheet}
            onSave={(code) => onSave("scss", code)}
          />
        </div>
      </div>
    </div>
  );
}
