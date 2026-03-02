import { FormatterLanguage } from "@/sandbox/formatter";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  configureTypescriptDefaults,
  disposeSharedScriptLibs,
  saveEditorCode,
  selectSharedScriptsForUserscript,
  syncSharedScriptLibs,
} from "@/shared/store/slices/editor.slice";
import { selectEditorSettings } from "@/shared/store/slices/settings.slice";
import { EditorSettings, UserscriptSourceLanguage } from "@shared/model";
import * as monaco from "monaco-editor";
import { useEffect, useMemo, useRef } from "react";

// Cache models by URI to preserve undo history and cursor position
const modelCache = new Map<string, monaco.editor.ITextModel>();

function getOrCreateModel(
  uri: string,
  language: UserscriptSourceLanguage,
  contents: string
): monaco.editor.ITextModel {
  const existing = modelCache.get(uri);
  if (existing && !existing.isDisposed()) {
    return existing;
  }

  const model = monaco.editor.createModel(contents, language, monaco.Uri.parse(uri));
  modelCache.set(uri, model);
  return model;
}

type CodeEditorProps = {
  /** Unique identifier for this editor's content */
  modelId: string;
  /** Script ID for Redux selectors and save thunk (omit for read-only previews) */
  scriptId?: string;
  contents: string;
  language: FormatterLanguage;
  editable?: boolean;
  /** Override the editor settings. */
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
  const reduxSettings = useAppSelector(selectEditorSettings);
  const settings = settingsOverride ? { ...reduxSettings, ...settingsOverride } : reduxSettings;

  const sharedScripts = useAppSelector(
    useMemo(() => selectSharedScriptsForUserscript(scriptId), [scriptId])
  );

  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const onCodeModifiedRef = useRef(onCodeModified);

  // Initialize editor once on mount
  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const editorInstance = monaco.editor.create(editorRef.current, {
      automaticLayout: true,
      overflowWidgetsDomNode: editorRef.current,
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

  // Swap model when modelId changes (switching scripts)
  useEffect(() => {
    const editorInstance = editorInstanceRef.current;

    if (!editorInstance) {
      return;
    }

    const uri = `file:///${modelId}.${language}`;
    const model = getOrCreateModel(uri, language, contents);

    editorInstance.setModel(model);

    /**
     * Setting a TypeScript model for the Monaco Editor instance triggers the TypeScript contribution module to load.
     *
     * We need to ensure the TypeScript language service defaults are configured after this happens so that our custom
     * compiler options are applied, then Monaco can provide accurate intellisense and diagnostics for userscript code.
     */
    if (language === "typescript") {
      dispatch(configureTypescriptDefaults());
    }

    // Listen to content changes on this model
    if (!onCodeModifiedRef.current) {
      return;
    }

    const disposable = model.onDidChangeContent(() => {
      onCodeModifiedRef.current?.(model.getValue());
    });

    return () => disposable.dispose();
  }, [modelId, language, contents]);

  // Register shared script type declarations for TypeScript intellisense
  useEffect(() => {
    if (language !== "typescript" || !sharedScripts) {
      return;
    }

    dispatch(syncSharedScriptLibs(sharedScripts));

    return () => {
      dispatch(disposeSharedScriptLibs());
    };
  }, [language, sharedScripts, dispatch]);

  // Handle Ctrl+S on the container — formats (optional) and saves via Redux thunk
  useEffect(() => {
    if (!editable || !scriptId) {
      return;
    }

    const container = editorRef.current;

    if (!container) {
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

        // If formatting occurred, update the editor with the formatted code
        if (saveEditorCode.fulfilled.match(result)) {
          editorInstance.setValue(result.payload.code);
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [editable, scriptId, settings?.autoFormat, language, dispatch]);

  return (
    <div
      ref={editorRef}
      style={{
        width: "100%",
        height: "100%",
      }}
    ></div>
  );
}
