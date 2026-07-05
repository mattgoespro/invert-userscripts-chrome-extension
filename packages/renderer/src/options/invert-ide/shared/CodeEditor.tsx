import { FormatterLanguage } from "@/sandbox/formatter";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { saveEditorCode } from "@/shared/store/slices/code-editor/thunks.code-editor";
import { selectEditorSettings } from "@/shared/store/slices/settings";
import { EditorSettings } from "@shared/model";
import * as monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import {
  attachEditorModel,
  buildModelUri,
  disposeModel,
} from "../components/code-editor/model-cache";

export type CodeEditorProps = {
  modelId: string;
  scriptId?: string;
  contents: string;
  language: FormatterLanguage;
  editable?: boolean;
  settingsOverride?: Partial<EditorSettings>;
  disposeModelOnUnmount?: boolean;
  /** Bumps whenever the draft layer pushes new contents into the editor. */
  syncRevision?: number;
  /** When true, external contents must not overwrite the model. */
  bufferDirty?: boolean;
  onCodeModified?: (value: string) => void;
  onSave?: (args: {
    code: string;
    language: FormatterLanguage;
    autoFormat: boolean;
    scriptId?: string;
  }) => Promise<string | void>;
  onEditorReady?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onModelFlushed?: (value: string) => void;
};

export function CodeEditor(props: CodeEditorProps) {
  const {
    modelId,
    scriptId,
    language,
    contents,
    settingsOverride,
    editable = true,
    disposeModelOnUnmount = false,
    syncRevision = 0,
    bufferDirty = false,
    onCodeModified,
    onSave,
    onEditorReady,
    onModelFlushed,
  } = props;

  const dispatch = useAppDispatch();
  const appEditorSettings = useAppSelector(selectEditorSettings);
  const settings = settingsOverride
    ? { ...appEditorSettings, ...settingsOverride }
    : appEditorSettings;

  const editorRootRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor>(null);
  const onCodeModifiedRef = useRef(onCodeModified);
  const onEditorReadyRef = useRef(onEditorReady);
  const onModelFlushedRef = useRef(onModelFlushed);
  const suppressModelChangeRef = useRef(false);
  const attachedModelUriRef = useRef<string | null>(null);
  const attachedScriptIdRef = useRef<string | undefined>(scriptId);

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
      theme: settings.theme,
      wordWrap: "on",
    });

    editorInstanceRef.current = editorInstance;

    return () => {
      const model = editorInstance.getModel();
      const disposeUri =
        model && !model.isDisposed() ? model.uri.toString() : null;

      if (model && !model.isDisposed() && onModelFlushedRef.current) {
        onModelFlushedRef.current(model.getValue());
      }

      editorInstance.setModel(null);
      editorInstance.dispose();
      editorInstanceRef.current = null;
      attachedModelUriRef.current = null;
      attachedScriptIdRef.current = undefined;

      if ((!editable || disposeModelOnUnmount) && disposeUri) {
        disposeModel(disposeUri);
      }
    };
  }, []);

  useEffect(() => {
    onCodeModifiedRef.current = onCodeModified;
  }, [onCodeModified]);

  useEffect(() => {
    onEditorReadyRef.current = onEditorReady;
  }, [onEditorReady]);

  useEffect(() => {
    onModelFlushedRef.current = onModelFlushed;
  }, [onModelFlushed]);

  useEffect(() => {
    monaco.editor.setTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    editorInstanceRef.current?.updateOptions({ fontSize: settings.fontSize });
  }, [settings.fontSize]);

  useEffect(() => {
    const editorInstance = editorInstanceRef.current;

    if (!editorInstance) {
      return;
    }

    const uri = buildModelUri(modelId, language);
    const previousModel = editorInstance.getModel();
    const previousUri =
      previousModel && !previousModel.isDisposed()
        ? previousModel.uri.toString()
        : attachedModelUriRef.current;
    const previousScriptId = attachedScriptIdRef.current;
    const model = attachEditorModel(
      editorInstance,
      uri,
      language,
      contents
    );

    attachedModelUriRef.current = uri;
    attachedScriptIdRef.current = scriptId;

    if (
      previousUri &&
      previousUri !== uri &&
      previousScriptId &&
      previousScriptId === scriptId
    ) {
      disposeModel(previousUri);
    }

    onEditorReadyRef.current?.(editorInstance);

    if (!onCodeModifiedRef.current) {
      return;
    }

    const disposable = model.onDidChangeContent(() => {
      if (!suppressModelChangeRef.current) {
        onCodeModifiedRef.current?.(model.getValue());
      }
    });

    return () => disposable.dispose();
  }, [modelId, language, editable, syncRevision, contents, scriptId]);

  useEffect(() => {
    const editorInstance = editorInstanceRef.current;

    if (!editorInstance) {
      return;
    }

    const uri = buildModelUri(modelId, language);
    let model = editorInstance.getModel();

    if (!model || model.isDisposed()) {
      model = attachEditorModel(editorInstance, uri, language, contents);
    } else if (model.uri.toString() !== uri) {
      model = attachEditorModel(editorInstance, uri, language, contents);
    }

    if (editable && bufferDirty) {
      return;
    }

    if (model.getValue() === contents) {
      return;
    }

    suppressModelChangeRef.current = true;
    model.setValue(contents);
    suppressModelChangeRef.current = false;
  }, [contents, syncRevision, editable, bufferDirty, modelId, language]);

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

        const code = editorInstance.getValue();
        const autoFormat = settings?.autoFormat ?? false;

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

        const savedCode =
          typeof result === "string"
            ? result
            : result &&
                typeof result === "object" &&
                "code" in result &&
                typeof result.code === "string"
              ? result.code
              : code;

        const model = editorInstance.getModel();

        if (!model) {
          return;
        }

        const savedSelections = editorInstance.getSelections() ?? [];

        suppressModelChangeRef.current = true;
        editorInstance.executeEdits(
          "prettier-format",
          [{ range: model.getFullModelRange(), text: savedCode }],
          savedSelections
        );
        suppressModelChangeRef.current = false;
      }
    };

    editorElement.addEventListener("keydown", handleKeyDown);

    return () => editorElement.removeEventListener("keydown", handleKeyDown);
  }, [editable, scriptId, settings?.autoFormat, language, dispatch, onSave]);

  return <div ref={editorRootRef} className="h-full w-full min-w-0"></div>;
}
