import { CodeEditor } from "@/options/invert-ide/code-editor/CodeEditor";
import { Userscript, UserscriptCode } from "@shared/model";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import "./ScriptEditor.scss";
import { useAppDispatch } from "@/shared/store/hooks";
import { updateUserscriptCode } from "@/shared/store/slices/userscripts.slice";

type ScriptEditorProps = {
  script: Userscript;
};

export function ScriptEditor({ script }: ScriptEditorProps) {
  const dispatch = useAppDispatch();

  const onSave = async (language: UserscriptCode, code: string) => {
    dispatch(updateUserscriptCode({ id: script.id, language, code }));
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
            contents={script.code.typescript}
            onSave={(code) => onSave("typescript", code)}
          />
        </div>
        <div className="script-editor--code-editor">
          <CodeEditor
            language="scss"
            contents={script.code.scss}
            onSave={(code) => onSave("scss", code)}
          />
        </div>
      </div>
    </div>
  );
}
