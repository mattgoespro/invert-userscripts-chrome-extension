import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  markUserscriptModified,
  selectCurrentUserscript,
  updateUserscriptCode,
} from "@/shared/store/slices/userscripts.slice";
import { selectAutoFormat, selectTheme } from "@/shared/store/slices/settings.slice";
import { UserscriptSourceCode } from "@shared/model";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import "./ScriptEditor.scss";

export function ScriptEditor() {
  const dispatch = useAppDispatch();
  const script = useAppSelector(selectCurrentUserscript);
  const autoFormat = useAppSelector(selectAutoFormat);
  const theme = useAppSelector(selectTheme);

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
            modelId={script.id}
            theme={theme}
            language="typescript"
            contents={script.code.source.typescript}
            autoFormat={autoFormat}
            onCodeModified={() => onCodeModified()}
            onCodeSaved={(code) => onCodeSaved("typescript", code)}
          />
        </div>
        <div className="script-editor--code-editor">
          <CodeEditor
            modelId={script.id}
            theme={theme}
            language="scss"
            contents={script.code.source.scss}
            autoFormat={autoFormat}
            onCodeModified={() => onCodeModified()}
            onCodeSaved={(code) => onCodeSaved("scss", code)}
          />
        </div>
      </div>
    </div>
  );
}
