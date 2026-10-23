import { captureEditorSave } from "@/shared/services/draft-save-lifecycle";
import { flushScriptModelsToDraft } from "@/shared/store/select-userscript";
import { store } from "@/shared/store/store";
import { FormatterLanguage } from "@/sandbox/formatter";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { saveEditorCode } from "@/shared/store/slices/code-editor/thunks.code-editor";
import { selectEditorSettings } from "@/shared/store/slices/settings";
import { describeApplyResult } from "@/shared/store/slices/userscripts/messaging";
import { EditorSettings } from "@shared/model";
import { resolveEditorTheme } from "@shared/editor-theme";
import {
  attachWorkspaceModel,
  buildModelUri,
  disposeDetachedModel,
  getOrCreateDetachedModel,
} from "@packages/monaco";
import * as monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { attachErrorLens } from "./error-lens";

export type CodeEditorProps = {
  modelId: string;
  /**
   * Present for script buffers: the model is owned by the workspace (created
   * up front, content-synced by the WorkspaceService, never disposed by the
   * editor). Absent for auxiliary editors (previews, compiled output) whose
   * detached models this component owns and disposes.
   *
   * Monaco → draft flush on script switch is owned by `selectUserscript`, not
   * by this component's unmount path.
   */
  scriptId?: string;
  contents: string;
  language: FormatterLanguage;
  editable?: boolean;
  settingsOverride?: Partial<EditorSettings>;
  onCodeModified?: (value: string) => void;
  onSave?: (args: {
    code: string;
    language: FormatterLanguage;
    autoFormat: boolean;
    scriptId?: string;
  }) => Promise<string | void>;
  onEditorReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
};

export function CodeEditor(props: CodeEditorProps) {
  const {
    modelId,
    scriptId,
    language,
    contents,
    settingsOverride,
    editable = true,
    onCodeModified,
    onSave,
    onEditorReady,
  } = props;

  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const appEditorSettings = useAppSelector(selectEditorSettings);
  const settings = settingsOverride
    ? { ...appEditorSettings, ...settingsOverride }
    : appEditorSettings;
  const editorTheme = resolveEditorTheme(settings.theme, settings.appTheme);

  const editorRootRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const errorLensRef = useRef<monaco.IDisposable>(null);
  const onCodeModifiedRef = useRef(onCodeModified);
  const onEditorReadyRef = useRef(onEditorReady);
  const isWorkspaceModel = scriptId != null;

  useEffect(() => {
    if (!editorRootRef.current) {
      return;
    }

    const editorInstance = monaco.editor.create(editorRootRef.current, {
      automaticLayout: true,
      cursorBlinking: editable ? "blink" : "solid",
      cursorStyle: editable ? "line" : "underline-thin",
      cursorWidth: editable ? undefined : 0,
      domReadOnly: !editable,
      fixedOverflowWidgets: true,
      fontSize: settings.fontSize,
      hideCursorInOverviewRuler: true,
      lineNumbers: editable ? "on" : "off",
      matchBrackets: editable ? "always" : "never",
      minimap: { enabled: false },
      occurrencesHighlight: editable ? "singleFile" : "off",
      padding: { top: 25, bottom: 10 },
      readOnly: !editable,
      renderLineHighlight: editable ? "gutter" : "none",
      bracketPairColorization: {
        enabled: true,
      },
      stickyScroll: { enabled: false },
      scrollbar: {
        vertical: "hidden",
        horizontal: "hidden",
        useShadows: false,
        verticalScrollbarSize: 0,
        horizontalScrollbarSize: 0,
        handleMouseWheel: editable,
      },
      scrollBeyondLastLine: editable,
      selectionHighlight: editable,
      theme: editorTheme,
      wordWrap: "on",
    });

    editorInstanceRef.current = editorInstance;

    return () => {
      errorLensRef.current?.dispose();
      errorLensRef.current = null;
      const model = editorInstance.getModel();
      const modelUri =
        model && !model.isDisposed() ? model.uri.toString() : null;

      editorInstance.setModel(null);
      editorInstance.dispose();
      editorInstanceRef.current = null;

      // Workspace models outlive editors; detached preview models don't.
      if (!isWorkspaceModel && modelUri) {
        disposeDetachedModel(modelUri);
      }
    };
  }, []);

  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor || !editable || settings.errorLens === false) {
      return;
    }
    errorLensRef.current = attachErrorLens(editor);
    return () => {
      errorLensRef.current?.dispose();
      errorLensRef.current = null;
    };
  }, [editable, settings.errorLens]);

  useEffect(() => {
    onCodeModifiedRef.current = onCodeModified;
  }, [onCodeModified]);

  useEffect(() => {
    onEditorReadyRef.current = onEditorReady;
  }, [onEditorReady]);

  useEffect(() => {
    monaco.editor.setTheme(editorTheme);
  }, [editorTheme]);

  useEffect(() => {
    editorInstanceRef.current?.updateOptions({ fontSize: settings.fontSize });
  }, [settings.fontSize]);

  // Attach the model for this URI and forward buffer changes.
  useEffect(() => {
    const editorInstance = editorInstanceRef.current;

    if (!editorInstance) {
      return;
    }

    const uri = buildModelUri(modelId, language);
    const model = isWorkspaceModel
      ? attachWorkspaceModel(editorInstance, uri, language, contents)
      : getOrCreateDetachedModel(uri, language, contents);

    if (editorInstance.getModel() !== model) {
      editorInstance.setModel(model);
    }

    onEditorReadyRef.current?.(editorInstance);

    const disposable = model.onDidChangeContent(() => {
      onCodeModifiedRef.current?.(model.getValue());
    });

    return () => {
      disposable.dispose();
    };
    // `contents` is intentionally omitted: workspace models are synced by
    // WorkspaceService. Re-running this effect on every draft keystroke tore
    // down onDidChangeContent and dropped unsaved text on script switch.
  }, [modelId, language, isWorkspaceModel]);

  // Detached preview models have no workspace sync; mirror the contents prop.
  useEffect(() => {
    if (isWorkspaceModel) {
      return;
    }

    const model = editorInstanceRef.current?.getModel();

    if (model && !model.isDisposed() && model.getValue() !== contents) {
      model.setValue(contents);
    }
  }, [contents, isWorkspaceModel, modelId, language]);

  useEffect(() => {
    if (!editable || !scriptId || !editorRootRef.current) {
      return;
    }

    const editorElement = editorRootRef.current;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();

        const editorInstance = editorInstanceRef.current;

        if (!editorInstance) {
          return;
        }

        const autoFormat = settings?.autoFormat ?? false;
        // Prettier emits LF. Normalize the model before capturing save versions
        // and draft text: edit operations otherwise retain CRLF and their change
        // event makes the freshly saved LF baseline look like another edit.
        const model = editorInstance.getModel();
        if (autoFormat && model?.getEOL() === "\r\n") {
          model.pushEOL(monaco.editor.EndOfLineSequence.LF);
        }
        const applyFormattedCode = captureEditorSave(editorInstance);
        // Capture all buffers before a focused save; Redux may still be catching up.
        const sessionScript = store.getState().userscripts.scripts[scriptId];
        if (sessionScript) {
          dispatch(flushScriptModelsToDraft(sessionScript));
        }
        const code = editorInstance.getValue();

        const result = onSave
          ? await onSave({
              code,
              language,
              autoFormat,
              scriptId,
            })
          : await dispatch(
              saveEditorCode({
                scriptId,
                language,
                code,
                autoFormat,
              })
            ).unwrap();

        if (
          result &&
          typeof result === "object" &&
          "appliedTabCount" in result &&
          typeof result.appliedTabCount === "number"
        ) {
          const applySuccess =
            "applySuccess" in result && result.applySuccess === false
              ? false
              : true;
          const staleSkipCount =
            "staleSkipCount" in result &&
            typeof result.staleSkipCount === "number"
              ? result.staleSkipCount
              : 0;
          const feedback = describeApplyResult({
            success: applySuccess,
            appliedTabCount: result.appliedTabCount,
            staleSkipCount,
          });

          toast({
            variant: feedback.variant,
            message: feedback.message,
          });
        }

        const savedCode =
          typeof result === "string"
            ? result
            : result &&
                typeof result === "object" &&
                "code" in result &&
                typeof result.code === "string"
              ? result.code
              : code;

        applyFormattedCode(savedCode);
      }
    };

    editorElement.addEventListener("keydown", handleKeyDown);

    return () => editorElement.removeEventListener("keydown", handleKeyDown);
  }, [
    editable,
    scriptId,
    settings?.autoFormat,
    language,
    dispatch,
    onSave,
    toast,
  ]);

  return <div ref={editorRootRef} className="h-full w-full min-w-0"></div>;
}
