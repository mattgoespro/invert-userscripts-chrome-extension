import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import { ResizeHandle } from "@/shared/components/resize-handle/ResizeHandle";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  markUserscriptModified,
  selectCurrentUserscript,
  updateUserscriptCode,
} from "@/shared/store/slices/userscripts.slice";
import { selectAutoFormat, selectTheme } from "@/shared/store/slices/settings.slice";
import { UserscriptSourceCode } from "@shared/model";
import { useCallback, useRef, useState } from "react";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import "./ScriptEditor.scss";

const MIN_PANEL_WIDTH_PERCENT = 20;
const MAX_PANEL_WIDTH_PERCENT = 80;

export function ScriptEditor() {
  const dispatch = useAppDispatch();
  const script = useAppSelector(selectCurrentUserscript);
  const autoFormat = useAppSelector(selectAutoFormat);
  const theme = useAppSelector(selectTheme);
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPanelPercent, setLeftPanelPercent] = useState(50);

  const handleResize = useCallback((delta: number) => {
    if (!containerRef.current) return;

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

  const onCodeSaved = async (language: UserscriptSourceCode, code: string) => {
    dispatch(updateUserscriptCode({ id: script.id, language, code }));
  };

  return (
    <div className="script-editor--editor-area">
      <div className="script-editor--editor-header">
        <ScriptMetadata script={script} />
      </div>
      <div className="script-editor--editor-container" ref={containerRef}>
        <div
          className="script-editor--code-editor"
          style={{ flex: `0 0 calc(${leftPanelPercent}% - 6px)` }}
        >
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
        <ResizeHandle direction="horizontal" onResize={handleResize} />
        <div
          className="script-editor--code-editor"
          style={{ flex: `0 0 calc(${100 - leftPanelPercent}% - 6px)` }}
        >
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
