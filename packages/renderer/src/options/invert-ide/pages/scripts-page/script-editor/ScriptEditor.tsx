import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import { ResizeHandle } from "@/shared/components/resize-handle/ResizeHandle";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { initializeMonaco, selectMonacoReady } from "@/shared/store/slices/editor.slice";
import {
  markUserscriptModified,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import "./ScriptEditor.scss";

const MIN_PANEL_WIDTH_PERCENT = 20;
const MAX_PANEL_WIDTH_PERCENT = 80;

export function ScriptEditor() {
  const dispatch = useAppDispatch();
  const script = useAppSelector(selectCurrentUserscript);
  const monacoReady = useAppSelector(selectMonacoReady);
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPanelPercent, setLeftPanelPercent] = useState(50);

  useEffect(() => {
    dispatch(initializeMonaco());
  }, [dispatch]);

  const handleResize = useCallback((delta: number) => {
    if (!containerRef.current) {
      return;
    }

    const containerWidth = containerRef.current.offsetWidth;
    const deltaPercent = (delta / containerWidth) * 100;

    setLeftPanelPercent((prev) => {
      const newPercent = prev + deltaPercent;
      return Math.max(MIN_PANEL_WIDTH_PERCENT, Math.min(MAX_PANEL_WIDTH_PERCENT, newPercent));
    });
  }, []);

  const onCodeModified = () => {
    if (script.status !== "modified") {
      dispatch(markUserscriptModified(script.id));
    }
  };

  return (
    <div className="script-editor--editor-area">
      <div className="script-editor--editor-header">
        <ScriptMetadata script={script} />
      </div>
      <div className="script-editor--editor-container" ref={containerRef}>
        {monacoReady && (
          <>
            <div
              className="script-editor--code-editor"
              style={{ flex: `0 0 calc(${leftPanelPercent}% - 6px)` }}
            >
              <CodeEditor
                modelId={script.id}
                scriptId={script.id}
                language="typescript"
                contents={script.code.source.typescript}
                onCodeModified={() => onCodeModified()}
              />
            </div>
            <ResizeHandle direction="horizontal" onResize={handleResize} />
            <div
              className="script-editor--code-editor"
              style={{ flex: `0 0 calc(${100 - leftPanelPercent}% - 6px)` }}
            >
              <CodeEditor
                modelId={script.id}
                scriptId={script.id}
                language="scss"
                contents={script.code.source.scss}
                onCodeModified={() => onCodeModified()}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
