import { CodeEditor } from "@/options/invert-ide/shared/CodeEditor";
import { TypeDefinitionCodeEditor } from "@/options/invert-ide/components/code-editor/TypeDefinitionCodeEditor";
import { TypeScriptCodeEditor } from "@/options/invert-ide/components/code-editor/TypeScriptCodeEditor";
import {
  buildUserscriptJavascript,
  buildUserscriptStylesheet,
  getCompiledOutputBuildOptions,
} from "@/sandbox/compiler";
import { ResizeHandle } from "@/shared/components/resize-handle/ResizeHandle";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectMonacoReady } from "@/shared/store/slices/code-editor";
import { selectEditorSettings } from "@/shared/store/slices/settings";
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
import type * as monaco from "monaco-editor";
import { useEditorErrorTracking } from "@/shared/hooks/useEditorErrorTracking";

export function ScriptEditor() {
  type EditorLanguage = UserscriptSourceLanguage | "type-definition";

  const dispatch = useAppDispatch();
  const script = useAppSelector(selectCurrentUserscript);
  const monacoReady = useAppSelector(selectMonacoReady);
  const settings = useAppSelector(selectEditorSettings);
  const { globalState, updateGlobalState, updatePanelSizes } = useGlobalState();

  const [liveJs, setLiveJs] = useState("");
  const [liveCss, setLiveCss] = useState("");
  const [liveTypeDefinitions, setLiveTypeDefinitions] = useState("");
  const [liveTypescriptSource, setLiveTypescriptSource] = useState(
    script.code.source.typescript
  );
  const [liveScssSource, setLiveScssSource] = useState(script.code.source.scss);
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(
    globalState.outputDrawerCollapsed
  );
  const [tsEditorInstance, setTsEditorInstance] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [typeDefinitionEditorInstance, setTypeDefinitionEditorInstance] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [scssEditorInstance, setScssEditorInstance] =
    useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [tsModel, setTsModel] = useState<monaco.editor.ITextModel | null>(null);
  const [typeDefinitionModel, setTypeDefinitionModel] =
    useState<monaco.editor.ITextModel | null>(null);
  const [scssModel, setScssModel] = useState<monaco.editor.ITextModel | null>(
    null
  );

  const drawerPanelRef = useRef<PanelImperativeHandle>(null);
  const scssDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Track TypeScript errors
  useEditorErrorTracking(script.id, tsModel, "typescript");

  // Track declaration file errors
  useEditorErrorTracking(script.id, typeDefinitionModel, "type-definition");

  // Track SCSS errors
  useEditorErrorTracking(script.id, scssModel, "scss");

  useEffect(() => {
    setLiveTypescriptSource(script.code.source.typescript);
  }, [script.id, script.code.source.typescript]);

  useEffect(() => {
    setLiveScssSource(script.code.source.scss);
  }, [script.id, script.code.source.scss]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await buildUserscriptJavascript(
        script,
        liveTypescriptSource,
        getCompiledOutputBuildOptions(settings)
      );

      if (!cancelled) {
        setLiveJs(result.success && result.code ? result.code : "");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    liveTypescriptSource,
    script.shared,
    script.moduleName,
    script.sharedScripts,
    settings.minifyCompiledOutput,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (scssDebounceRef.current) {
      clearTimeout(scssDebounceRef.current);
    }

    scssDebounceRef.current = setTimeout(async () => {
      const result = await buildUserscriptStylesheet(
        liveScssSource,
        getCompiledOutputBuildOptions(settings)
      );

      if (!cancelled) {
        setLiveCss(result.success && result.code ? result.code : "");
      }
    }, 400);

    return () => {
      cancelled = true;
      if (scssDebounceRef.current) {
        clearTimeout(scssDebounceRef.current);
      }
    };
  }, [liveScssSource, settings.minifyCompiledOutput]);

  useEffect(() => {
    setLiveTypeDefinitions(script.typeDefinitions);
  }, [script.id, script.typeDefinitions]);

  const onCodeModified = (language: EditorLanguage, code: string) => {
    if (script.status !== "modified") {
      dispatch(markUserscriptModified(script.id));
    }

    if (language === "typescript") {
      setLiveTypescriptSource(code);
    } else if (language === "scss") {
      setLiveScssSource(code);
    } else if (language === "type-definition") {
      setLiveTypeDefinitions(code);
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
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex min-w-0 items-center gap-sm border-b border-border bg-surface-raised p-sm px-md">
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
                  <Group
                    orientation="vertical"
                    id="script-editor-typescript-stack"
                    style={{ height: "100%" }}
                    defaultLayout={{
                      "typescript-source":
                        globalState.panelSizes
                          .scriptTypeDefinitionsVerticalSplit,
                      "typescript-definitions":
                        100 -
                        globalState.panelSizes
                          .scriptTypeDefinitionsVerticalSplit,
                    }}
                    onLayoutChanged={(layout) => {
                      const sourceSize = layout["typescript-source"];
                      if (sourceSize != null) {
                        updatePanelSizes({
                          scriptTypeDefinitionsVerticalSplit: sourceSize,
                        });
                      }
                    }}
                  >
                    <Panel id="typescript-source" minSize="35%">
                      <div className="relative flex h-full flex-col overflow-hidden bg-surface-base">
                        <div className="pointer-events-none absolute top-2 right-6 z-10 select-none">
                          <Typography
                            variant="caption"
                            className="font-mono font-bold text-text-muted-faint"
                          >
                            // script.ts
                          </Typography>
                        </div>
                        <div className="min-h-0 min-w-0 flex-1">
                          <TypeScriptCodeEditor
                            modelId={`scripts/${script.id}/main`}
                            scriptId={script.id}
                            contents={script.code.source.typescript}
                            ambientTypeDefinitions={liveTypeDefinitions}
                            onCodeModified={(code) =>
                              onCodeModified("typescript", code)
                            }
                            onEditorReady={(editor) => {
                              setTsEditorInstance(editor);
                              setTsModel(editor.getModel());
                            }}
                          />
                        </div>
                      </div>
                    </Panel>
                    <ResizeHandle direction="vertical" />
                    <Panel id="typescript-definitions" minSize="20%">
                      <div className="relative flex h-full flex-col overflow-hidden bg-surface-base">
                        <div className="pointer-events-none absolute top-2 right-6 z-10 select-none">
                          <Typography
                            variant="caption"
                            className="font-mono font-bold text-text-muted-faint"
                          >
                            // types.d.ts
                          </Typography>
                        </div>
                        <div className="min-h-0 min-w-0 flex-1">
                          <TypeDefinitionCodeEditor
                            modelId={`scripts/${script.id}/types.d`}
                            scriptId={script.id}
                            contents={script.typeDefinitions}
                            onCodeModified={(code) =>
                              onCodeModified("type-definition", code)
                            }
                            onEditorReady={(editor) => {
                              setTypeDefinitionEditorInstance(editor);
                              setTypeDefinitionModel(editor.getModel());
                            }}
                          />
                        </div>
                      </div>
                    </Panel>
                  </Group>
                </Panel>
                <ResizeHandle direction="horizontal" />
                <Panel id="scss-editor" minSize="20%" maxSize="80%">
                  <div className="relative flex h-full flex-col overflow-hidden bg-surface-base">
                    <div className="pointer-events-none absolute top-2 right-6 z-10 select-none">
                      <Typography
                        variant="caption"
                        className="font-mono font-bold text-text-muted-faint"
                      >
                        // styles.scss
                      </Typography>
                    </div>
                    <div className="min-h-0 min-w-0 flex-1">
                      <CodeEditor
                        modelId={`scripts/${script.id}/styles`}
                        scriptId={script.id}
                        language="scss"
                        contents={script.code.source.scss}
                        onCodeModified={(code) => onCodeModified("scss", code)}
                        onEditorReady={(editor) => {
                          setScssEditorInstance(editor);
                          setScssModel(editor.getModel());
                        }}
                      />
                    </div>
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
              defaultSize={`${100 - globalState.panelSizes.scriptCompiledOutputDrawerSplit}%`}
              collapsible
              collapsedSize="36px"
              onResize={onDrawerResize}
            >
              <div className="h-full overflow-hidden bg-surface-base">
                <ScriptEditorDrawer
                  script={script}
                  javascript={liveJs}
                  css={liveCss}
                  isCollapsed={isDrawerCollapsed}
                  onToggleCollapse={onToggleDrawer}
                  editorInstances={{
                    typescript: tsEditorInstance ?? undefined,
                    "type-definition":
                      typeDefinitionEditorInstance ?? undefined,
                    scss: scssEditorInstance ?? undefined,
                  }}
                />
              </div>
            </Panel>
          </Group>
        )}
      </div>
    </div>
  );
}
