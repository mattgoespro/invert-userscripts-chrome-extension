import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import { ResizeHandle } from "@/shared/components/resize-handle/ResizeHandle";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { initializeMonaco, selectMonacoReady } from "@/shared/store/slices/editor.slice";
import {
  markUserscriptModified,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { useEffect } from "react";
import { Group, Panel } from "react-resizable-panels";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import "./ScriptEditor.scss";

export function ScriptEditor() {
  const dispatch = useAppDispatch();
  const script = useAppSelector(selectCurrentUserscript);
  const monacoReady = useAppSelector(selectMonacoReady);

  useEffect(() => {
    dispatch(initializeMonaco());
  }, [dispatch]);

  const onCodeModified = () => {
    if (script.status !== "modified") {
      dispatch(markUserscriptModified(script.id));
    }
  };

  return (
    <div className="script-editor--editor-area">
      <div className="script-editor--editor-header">
        <ScriptMetadata key={script.id} script={script} />
      </div>
      <div className="script-editor--editor-container">
        {monacoReady && (
          <Group orientation="horizontal" id="script-editor-panels">
            <Panel id="typescript-editor" minSize="20%" maxSize="80%" defaultSize="50%">
              <div className="script-editor--code-editor">
                <CodeEditor
                  modelId={script.id}
                  scriptId={script.id}
                  language="typescript"
                  contents={script.code.source.typescript}
                  onCodeModified={() => onCodeModified()}
                />
              </div>
            </Panel>
            <ResizeHandle direction="horizontal" />
            <Panel id="scss-editor" minSize="20%" maxSize="80%" defaultSize="50%">
              <div className="script-editor--code-editor">
                <CodeEditor
                  modelId={script.id}
                  scriptId={script.id}
                  language="scss"
                  contents={script.code.source.scss}
                  onCodeModified={() => onCodeModified()}
                />
              </div>
            </Panel>
          </Group>
        )}
      </div>
    </div>
  );
}
