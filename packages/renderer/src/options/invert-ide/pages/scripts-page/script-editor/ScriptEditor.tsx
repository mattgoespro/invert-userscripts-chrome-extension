import { CodeEditor } from "@/options/invert-ide/code-editor/CodeEditor";
import { useAppDispatch } from "@/shared/store/hooks";
import { setUserscriptStatus, updateUserscriptCode } from "@/shared/store/slices/userscripts.slice";
import { TypeScriptCompiler } from "@shared/compiler";
import { Userscript } from "@shared/model";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import "./ScriptEditor.scss";

type ScriptEditorProps = {
  script: Userscript;
};

export function ScriptEditor({ script }: ScriptEditorProps) {
  const dispatch = useAppDispatch();

  const onSave = async (language: "typescript" | "scss", code: string) => {
    switch (language) {
      case "typescript": {
        const output = TypeScriptCompiler.compile(code);

        if (output.success) {
          dispatch(updateUserscriptCode(script.id, "script", output.code));
        } else {
          // Handle compilation errors (could show in UI)
          console.error("Compilation Error:", output.error);
        }
      }
      case "scss": {
        dispatch(updateUserscriptCode(script.id, "stylesheet", code));
      }
    }
  };

  const onModify = () => {
    dispatch(setUserscriptStatus({ id: script.id, status: "modified" }));
  };

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
            onModify={() => onModify()}
          />
        </div>
        <div className="script-editor--code-editor">
          <CodeEditor
            language="scss"
            contents={script.code.stylesheet}
            onSave={(code) => onSave("scss", code)}
            onModify={() => onModify()}
          />
        </div>
      </div>
    </div>
  );
}
