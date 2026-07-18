import { CodeEditor } from "@/options/invert-ide/shared/CodeEditor";
import { TypeDefinitionCodeEditor } from "@/options/invert-ide/components/code-editor/TypeDefinitionCodeEditor";
import { TypeScriptCodeEditor } from "@/options/invert-ide/components/code-editor/TypeScriptCodeEditor";
import { buildScriptModelId } from "@packages/monaco";
import {
  buildUserscriptJavascript,
  buildUserscriptStylesheet,
  getCompiledOutputBuildOptions,
} from "@/sandbox/compiler";
import { ResizeHandle } from "@/shared/components/resize-handle/ResizeHandle";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  selectIdeReady,
  selectMonacoReady,
} from "@/shared/store/slices/code-editor";
import {
  selectDraftForScript,
  updateDraftBuffer,
} from "@/shared/store/slices/editor-drafts";
import { selectEditorSettings } from "@/shared/store/slices/settings";
import { selectCurrentUserscript } from "@/shared/store/slices/userscripts";
import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { UserscriptSourceLanguage } from "@shared/model";
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Panel, PanelImperativeHandle } from "react-resizable-panels";
import { ScriptEditorDrawer } from "./script-editor-drawer/ScriptEditorDrawer";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";
import type * as monaco from "monaco-editor";
import { useEditorErrorTracking } from "@/shared/hooks/useEditorErrorTracking";

type EditorBuffer = UserscriptSourceLanguage | "typeDefinitions";

export function ScriptEditor() {
  const dispatch = useAppDispatch();
  const script = useAppSelector(selectCurrentUserscript);
  const ideReady = useAppSelector(selectIdeReady);
  const monacoReady = useAppSelector(selectMonacoReady);
  const settings = useAppSelector(selectEditorSettings);
  const draft = useAppSelector(selectDraftForScript(script.id));
  const { globalState, updateGlobalState, updatePanelSizes } = useGlobalState();

  const [liveJs, setLiveJs] = useState("");
  const [liveCss, setLiveCss] = useState("");
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

  const typescriptSource = draft?.typescript ?? script.code.source.typescript;
  const scssSource = draft?.scss ?? script.code.source.scss;
  const typeDefinitions = draft?.typeDefinitions ?? script.typeDefinitions;

  useEditorErrorTracking(script.id, tsModel, "typescript");
  useEditorErrorTracking(script.id, typeDefinitionModel, "type-definition");
  useEditorErrorTracking(script.id, scssModel, "scss");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await buildUserscriptJavascript(
        script,
        typescriptSource,
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
    typescriptSource,
    script.shared,
    script.moduleName,
    script.sharedScripts,
    settings.minifyCompiledOutput,
    script.id,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (scssDebounceRef.current) {
      clearTimeout(scssDebounceRef.current);
    }

    scssDebounceRef.current = setTimeout(async () => {
      const result = await buildUserscriptStylesheet(
        scssSource,
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
  }, [scssSource, settings.minifyCompiledOutput]);

  const flushDraftBuffer = useCallback(
    (buffer: EditorBuffer, code: string) => {
      dispatch(updateDraftBuffer({ scriptId: script.id, buffer, code }));
    },
    [dispatch, script.id]
  );

  const onCodeModified = (buffer: EditorBuffer, code: string) => {
    flushDraftBuffer(buffer, code);
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
        {ideReady && monacoReady ? (
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
                <Panel
                  id="typescript-editor"
                  data-testid="typescript-editor"
                  minSize="20%"
                  maxSize="80%"
                >
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
                    <Panel
                      id="typescript-source"
                      data-testid="typescript-source"
                      minSize="35%"
                    >
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
                            modelId={buildScriptModelId(script, "main")}
                            scriptId={script.id}
                            contents={typescriptSource}
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
                            modelId={buildScriptModelId(script, "types")}
                            scriptId={script.id}
                            contents={typeDefinitions}
                            onCodeModified={(code) =>
                              onCodeModified("typeDefinitions", code)
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
                        modelId={buildScriptModelId(script, "styles")}
                        scriptId={script.id}
                        language="scss"
                        contents={scssSource}
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
              data-testid="output-drawer"
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
        ) : (
          <div className="flex h-full items-center justify-center">
            <Typography variant="caption" className="text-text-muted-faint">
              Loading editor environment...
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
}
