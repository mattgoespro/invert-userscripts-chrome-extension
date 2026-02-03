import { CodeEditor } from "@/options/invert-ide/code-editor/CodeEditor";
import { UserscriptSourceCode } from "@shared/model";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import "./ScriptEditor.scss";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  markUserscriptModified,
  selectCurrentUserscript,
  updateUserscriptCode,
} from "@/shared/store/slices/userscripts.slice";

export function ScriptEditor() {
  const dispatch = useAppDispatch();
  const script = useAppSelector(selectCurrentUserscript);

  const onCodeModified = () => {
    if (script.status !== "modified") {
      dispatch(markUserscriptModified(script.id));
    }
  };

  const onCodeSaved = async (language: UserscriptSourceCode, code: string) => {
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
            theme="vs-dark"
            language="typescript"
            contents={script.code.source.typescript}
            onCodeModified={() => onCodeModified()}
            onCodeSaved={(code) => onCodeSaved("typescript", code)}
          />
        </div>
        <div className="script-editor--code-editor">
          <CodeEditor
            theme="vs-dark"
            language="scss"
            contents={script.code.source.scss}
            onCodeModified={() => onCodeModified()}
            onCodeSaved={(code) => onCodeSaved("scss", code)}
          />
        </div>
      </div>
    </div>
  );
}
