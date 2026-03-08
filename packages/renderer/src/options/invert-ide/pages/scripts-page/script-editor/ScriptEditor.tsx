import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import { SassCompiler, TypeScriptCompiler } from "@/sandbox/compiler";
import { ResizeHandle } from "@/shared/components/resize-handle/ResizeHandle";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { initializeMonaco, selectMonacoReady } from "@/shared/store/slices/editor.slice";
import {
  markUserscriptModified,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { useUIState } from "@/options/invert-ide/contexts/global-state.context";
import { UserscriptSourceLanguage } from "@shared/model";
import { useEffect, useRef, useState } from "react";
import { Group, Panel, PanelImperativeHandle } from "react-resizable-panels";
import { CompiledOutputDrawer } from "./compiled-output-drawer/CompiledOutputDrawer";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import "./ScriptEditor.scss";

export function ScriptEditor() {
  const dispatch = useAppDispatch();
  const script = useAppSelector(selectCurrentUserscript);
  const monacoReady = useAppSelector(selectMonacoReady);
  const { uiState, updateUIState, updatePanelSizes } = useUIState();

  const [liveJs, setLiveJs] = useState("");
  const [liveCss, setLiveCss] = useState("");
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(uiState.outputDrawerCollapsed);

  const drawerPanelRef = useRef<PanelImperativeHandle | null>(null);
  const scssDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dispatch(initializeMonaco());
  }, [dispatch]);

  // Auto-compile source code on mount and on script switch to pre-populate the output drawer.
  useEffect(() => {
    const tsResult = TypeScriptCompiler.compile(script.code.source.typescript);

    setLiveJs(tsResult.success && tsResult.code ? tsResult.code : "");

    SassCompiler.compile(script.code.source.scss).then((scssResult) => {
      setLiveCss(scssResult.success && scssResult.code ? scssResult.code : "");
    });

    return () => {
      if (scssDebounceRef.current) {
        clearTimeout(scssDebounceRef.current);
      }
    };
  }, [script.id]);

  // After a Ctrl+S save, the CodeEditor suppresses the onDidChangeContent event
  // that would normally recompile via onCodeModified. Instead, sync the drawer
  // directly from the compiled output that updateUserscriptCode.fulfilled writes
  // into Redux. The empty-string guard prevents clearing the drawer on initial
  // load (when compiled code is stripped from storage to save quota).
  useEffect(() => {
    if (script.code.compiled.javascript) {
      setLiveJs(script.code.compiled.javascript);
    }
  }, [script.code.compiled.javascript]);

  useEffect(() => {
    if (script.code.compiled.css) {
      setLiveCss(script.code.compiled.css);
    }
  }, [script.code.compiled.css]);

  const onCodeModified = (language: UserscriptSourceLanguage, code: string) => {
    if (script.status !== "modified") {
      dispatch(markUserscriptModified(script.id));
    }

    if (language === "typescript") {
      const result = TypeScriptCompiler.compile(code);

      if (result.success && result.code) {
        setLiveJs(result.code);
      }
    } else if (language === "scss") {
      if (scssDebounceRef.current) {
        clearTimeout(scssDebounceRef.current);
      }

      scssDebounceRef.current = setTimeout(async () => {
        const result = await SassCompiler.compile(code);

        if (result.success && result.code) {
          setLiveCss(result.code);
        }
      }, 400);
    }
  };

  const onToggleDrawer = () => {
    if (!drawerPanelRef.current) {
      return;
    }

    if (drawerPanelRef.current.isCollapsed()) {
      drawerPanelRef.current.expand();
    } else {
      drawerPanelRef.current.collapse();
    }
  };

  const onDrawerResize = () => {
    if (!drawerPanelRef.current) {
      return;
    }

    const collapsed = drawerPanelRef.current.isCollapsed();
    setIsDrawerCollapsed(collapsed);
    updateUIState({ outputDrawerCollapsed: collapsed });
  };

  return (
    <div className="script-editor--editor-area">
      <div className="script-editor--editor-header">
        <ScriptMetadata key={script.id} script={script} />
      </div>
      <div className="script-editor--editor-container">
        {monacoReady && (
          <Group
            orientation="vertical"
            id="script-editor-outer-panels"
            defaultLayout={{
              "source-panels": uiState.panelSizes.sourceVsDrawerSplit,
              "output-drawer": 100 - uiState.panelSizes.sourceVsDrawerSplit,
            }}
            onLayoutChanged={(layout) => {
              if (drawerPanelRef.current?.isCollapsed()) {
                return;
              }
              const sourceSize = layout["source-panels"];
              if (sourceSize != null) {
                updatePanelSizes({ sourceVsDrawerSplit: sourceSize });
              }
            }}
          >
            <Panel id="source-panels" minSize="20%">
              <Group
                orientation="horizontal"
                id="script-editor-source-panels"
                style={{ height: "100%" }}
                defaultLayout={{
                  "typescript-editor": uiState.panelSizes.tsScssHorizontalSplit,
                  "scss-editor": 100 - uiState.panelSizes.tsScssHorizontalSplit,
                }}
                onLayoutChanged={(layout) => {
                  const tsSize = layout["typescript-editor"];
                  if (tsSize != null) {
                    updatePanelSizes({ tsScssHorizontalSplit: tsSize });
                  }
                }}
              >
                <Panel id="typescript-editor" minSize="20%" maxSize="80%">
                  <div className="script-editor--code-editor">
                    <CodeEditor
                      modelId={script.id}
                      scriptId={script.id}
                      language="typescript"
                      contents={script.code.source.typescript}
                      onCodeModified={(code) => onCodeModified("typescript", code)}
                    />
                  </div>
                </Panel>
                <ResizeHandle direction="horizontal" />
                <Panel id="scss-editor" minSize="20%" maxSize="80%">
                  <div className="script-editor--code-editor">
                    <CodeEditor
                      modelId={script.id}
                      scriptId={script.id}
                      language="scss"
                      contents={script.code.source.scss}
                      onCodeModified={(code) => onCodeModified("scss", code)}
                    />
                  </div>
                </Panel>
              </Group>
            </Panel>
            <ResizeHandle direction="vertical" />
            <Panel
              panelRef={drawerPanelRef}
              id="output-drawer"
              minSize="15%"
              maxSize="60%"
              defaultSize={`${100 - uiState.panelSizes.sourceVsDrawerSplit}%`}
              collapsible
              collapsedSize="36px"
              onResize={onDrawerResize}
            >
              <div className="script-editor--output-drawer">
                <CompiledOutputDrawer
                  scriptId={script.id}
                  javascript={liveJs}
                  css={liveCss}
                  isCollapsed={isDrawerCollapsed}
                  onToggleCollapse={onToggleDrawer}
                />
              </div>
            </Panel>
          </Group>
        )}
      </div>
    </div>
  );
}
