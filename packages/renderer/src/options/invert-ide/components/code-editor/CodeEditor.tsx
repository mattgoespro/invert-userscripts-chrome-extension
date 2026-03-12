import { FormatterLanguage } from "@/sandbox/formatter";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { saveEditorCode } from "@/shared/store/slices/monaco-editor/thunks.monaco-editor";
import { selectEditorSettings } from "@/shared/store/slices/settings";
import { EditorSettings } from "@shared/model";
import * as monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { buildModelUri, disposeModel, getOrCreateModel } from "./model-cache";

export type CodeEditorProps = {
  /**
   * Unique identifier for this editor's content
   */
  modelId: string;
  /**
   * Script ID (omit for read-only previews)
   */
  scriptId?: string;
  /**
   * Initial contents of the editor
   */
  contents: string;
  /**
   * Language of the editor (for intellisense, highlighting and formatting)
   */
  language: FormatterLanguage;
  /**
   * Whether the editor is editable
   */
  editable?: boolean;
  /**
   * Options to override the app's saved editor settings.
   */
  settingsOverride?: Partial<EditorSettings>;
  onCodeModified?: (value: string) => void;
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
  } = props;

  const dispatch = useAppDispatch();
  const appEditorSettings = useAppSelector(selectEditorSettings);
  const settings = settingsOverride
    ? { ...appEditorSettings, ...settingsOverride }
    : appEditorSettings;

  const editorRootRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(
    null
  );
  const onCodeModifiedRef = useRef(onCodeModified);
  // When true, the model content change listener is muted. Used to prevent
  // programmatic setValue calls (e.g. post-save formatter apply) from being
  // misinterpreted as user edits and re-dispatching markUserscriptModified.
  const suppressModelChangeRef = useRef(false);

  // Initialize editor once on mount
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
      // Dispose the editor's model for read-only previews to prevent unbounded model accumulation.
      // Editable models are kept alive in the cache so undo history and cursor positions survive tab switches.
      if (!editable) {
        const model = editorInstance.getModel();
        if (model) {
          disposeModel(model.uri.toString());
        }
      }

      editorInstance.dispose();
      editorInstanceRef.current = null;
    };
  }, []);

  // Keep callback ref in sync (needed for model change listener)
  useEffect(() => {
    onCodeModifiedRef.current = onCodeModified;
  }, [onCodeModified]);

  // Update theme dynamically without recreating the editor
  useEffect(() => {
    monaco.editor.setTheme(settings.theme);
  }, [settings.theme]);

  // Update font size dynamically without recreating the editor
  useEffect(() => {
    editorInstanceRef.current?.updateOptions({ fontSize: settings.fontSize });
  }, [settings.fontSize]);

  // Swap model when modelId/language changes and attach content change listener
  useEffect(() => {
    const editorInstance = editorInstanceRef.current;

    if (!editorInstance) {
      return;
    }

    const uri = buildModelUri(modelId, language);
    const model = getOrCreateModel(uri, language, contents);
    const currentModel = editorInstance.getModel();

    if (currentModel !== model) {
      editorInstance.setModel(model);
    }

    if (!onCodeModifiedRef.current) {
      return;
    }

    const disposable = model.onDidChangeContent(() => {
      if (!suppressModelChangeRef.current) {
        onCodeModifiedRef.current?.(model.getValue());
      }
    });

    return () => disposable.dispose();
  }, [modelId, language, editable]);

  // Sync value for read-only editors when contents changes externally
  useEffect(() => {
    if (editable) {
      return;
    }

    const editorInstance = editorInstanceRef.current;
    const model = editorInstance?.getModel();

    if (model && model.getValue() !== contents) {
      model.setValue(contents);
    }
  }, [contents, editable]);

  // Handle code-saving and auto-formatting
  useEffect(() => {
    if (!editable || !scriptId || !editorRootRef.current) {
      return;
    }

    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();

        const editorInstance = editorInstanceRef.current;

        if (!editorInstance) {
          return;
        }

        const code = editorInstance.getValue();

        const result = await dispatch(
          saveEditorCode({
            scriptId,
            language,
            code,
            autoFormat: settings?.autoFormat ?? false,
          })
        );

        /**
         * Apply code back to the editor as a set of edits that replace the entire content. This ensures that:
         *   - Full undo/redo history is preserved
         *   - Cursor and selection positions are restored
         */
        if (saveEditorCode.fulfilled.match(result)) {
          const model = editorInstance.getModel();

          if (!model) {
            return;
          }

          const savedSelections = editorInstance.getSelections() ?? [];

          suppressModelChangeRef.current = true;
          editorInstance.executeEdits(
            "prettier-format",
            [{ range: model.getFullModelRange(), text: result.payload.code }],
            savedSelections
          );
          suppressModelChangeRef.current = false;
        }
      }
    };

    editorRootRef.current.addEventListener("keydown", handleKeyDown);

    return () =>
      editorRootRef.current?.removeEventListener("keydown", handleKeyDown);
  }, [editable, scriptId, settings?.autoFormat, language, dispatch]);

  return (
    <div
      ref={editorRootRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    ></div>
  );
}
