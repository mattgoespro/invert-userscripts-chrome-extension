import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import { TypeScriptCodeEditor } from "@/options/invert-ide/components/code-editor/TypeScriptCodeEditor";
import { SassCompiler, TypeScriptCompiler } from "@/sandbox/compiler";
import { EditorPanel } from "@/shared/components/editor-panel/EditorPanel";
import { ResizeHandle } from "@/shared/components/resize-handle/ResizeHandle";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectMonacoReady } from "@/shared/store/slices/monaco-editor";
import {
  markUserscriptModified,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts";
import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { UserscriptSourceLanguage } from "@shared/model";
import { useEffect, useRef, useState } from "react";
import { Group, Panel, PanelImperativeHandle } from "react-resizable-panels";
import { ScriptEditorDrawer } from "./script-editor-drawer/ScriptEditorDrawer";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";

export function ScriptEditor() {
  const dispatch = useAppDispatch();
  const script = useAppSelector(selectCurrentUserscript);
  const monacoReady = useAppSelector(selectMonacoReady);
  const { globalState, updateGlobalState, updatePanelSizes } = useGlobalState();

  const [liveJs, setLiveJs] = useState("");
  const [liveCss, setLiveCss] = useState("");
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(
    globalState.outputDrawerCollapsed
  );

  const drawerPanelRef = useRef<PanelImperativeHandle | null>(null);
  const scssDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    updateGlobalState({ outputDrawerCollapsed: collapsed });
  };

  return (
    <div className="gap-sm flex h-full min-w-0 flex-col overflow-hidden">
      <div className="bg-surface-raised border-border rounded-default p-sm px-md gap-sm flex items-center border">
        <ScriptMetadata key={script.id} script={script} />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {monacoReady && (
          <Group
            orientation="vertical"
            id="script-editor-outer-panels"
            defaultLayout={{
              "source-panels":
                globalState.panelSizes.scriptCompiledOutputDrawerSplit,
              "output-drawer":
                100 - globalState.panelSizes.scriptCompiledOutputDrawerSplit,
            }}
            onLayoutChanged={(layout) => {
              if (drawerPanelRef.current?.isCollapsed()) {
                return;
              }
              const sourceSize = layout["source-panels"];
              if (sourceSize != null) {
                updatePanelSizes({
                  scriptCompiledOutputDrawerSplit: sourceSize,
                });
              }
            }}
          >
            <Panel id="source-panels" minSize="20%">
              <Group
                orientation="horizontal"
                id="script-editor-source-panels"
                style={{ height: "100%" }}
                defaultLayout={{
                  "typescript-editor":
                    globalState.panelSizes.scriptCodeEditorHorizontalSplit,
                  "scss-editor":
                    100 -
                    globalState.panelSizes.scriptCodeEditorHorizontalSplit,
                }}
                onLayoutChanged={(layout) => {
                  const tsSize = layout["typescript-editor"];
                  if (tsSize != null) {
                    updatePanelSizes({
                      scriptCodeEditorHorizontalSplit: tsSize,
                    });
                  }
                }}
              >
                <Panel id="typescript-editor" minSize="20%" maxSize="80%">
                  <EditorPanel>
                    <TypeScriptCodeEditor
                      modelId={script.id}
                      scriptId={script.id}
                      contents={script.code.source.typescript}
                      onCodeModified={(code) =>
                        onCodeModified("typescript", code)
                      }
                    />
                  </EditorPanel>
                </Panel>
                <ResizeHandle direction="horizontal" />
                <Panel id="scss-editor" minSize="20%" maxSize="80%">
                  <EditorPanel>
                    <CodeEditor
                      modelId={script.id}
                      scriptId={script.id}
                      language="scss"
                      contents={script.code.source.scss}
                      onCodeModified={(code) => onCodeModified("scss", code)}
                    />
                  </EditorPanel>
                </Panel>
              </Group>
            </Panel>
            <ResizeHandle direction="vertical" />
            <Panel
              panelRef={drawerPanelRef}
              id="output-drawer"
              minSize="15%"
              maxSize="60%"
              defaultSize={`${100 - globalState.panelSizes.scriptCompiledOutputDrawerSplit}%`}
              collapsible
              collapsedSize="36px"
              onResize={onDrawerResize}
            >
              <EditorPanel className="overflow-hidden">
                <ScriptEditorDrawer
                  script={script}
                  javascript={liveJs}
                  css={liveCss}
                  isCollapsed={isDrawerCollapsed}
                  onToggleCollapse={onToggleDrawer}
                />
              </EditorPanel>
            </Panel>
          </Group>
        )}
      </div>
    </div>
  );
}
