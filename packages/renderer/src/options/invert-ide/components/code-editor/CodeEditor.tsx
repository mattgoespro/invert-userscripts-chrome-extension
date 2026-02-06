import { editor, Uri } from "monaco-editor";
import { useEffect, useRef } from "react";
import { FormatterLanguage, PrettierFormatter } from "@/sandbox/formatter";
import { getMonacoThemeName } from "@/shared/components/CodeEditorThemes";

// Cache models by URI to preserve undo history and cursor position
const modelCache = new Map<string, editor.ITextModel>();

function getOrCreateModel(uri: string, language: string, contents: string): editor.ITextModel {
  const existing = modelCache.get(uri);
  if (existing && !existing.isDisposed()) {
    return existing;
  }

  const model = editor.createModel(contents, language, Uri.parse(uri));
  modelCache.set(uri, model);
  return model;
}

type CodeEditorProps = {
  /** Unique identifier for this editor's content (e.g., scriptId) */
  modelId: string;
  theme: string;
  language: FormatterLanguage;
  contents: string;
  autoFormat?: boolean;
  onCodeModified: (value: string) => void;
  onCodeSaved: (value: string) => void;
};

export function CodeEditor({
  modelId,
  theme,
  language,
  contents,
  autoFormat = false,
  onCodeModified,
  onCodeSaved,
}: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const onCodeModifiedRef = useRef(onCodeModified);

  // Keep callback ref in sync (needed for model change listener)
  useEffect(() => {
    onCodeModifiedRef.current = onCodeModified;
  }, [onCodeModified]);

  // Initialize editor once on mount
  useEffect(() => {
    if (!editorRef.current) return;

    const editorInstance = editor.create(editorRef.current, {
      theme: getMonacoThemeName(theme),
      fontSize: 14,
      automaticLayout: true,
      padding: { top: 25, bottom: 10 },
      fixedOverflowWidgets: true,
      wordWrap: "on",
      minimap: { enabled: false },
      scrollbar: {
        verticalSliderSize: 6,
        verticalScrollbarSize: 6,
        verticalHasArrows: true,
      },
    });

    editorInstanceRef.current = editorInstance;

    return () => {
      editorInstance.dispose();
      editorInstanceRef.current = null;
    };
  }, []);

  // Update theme dynamically without recreating the editor
  useEffect(() => {
    editor.setTheme(getMonacoThemeName(theme));
  }, [theme]);

  // Swap model when modelId changes (switching scripts)
  useEffect(() => {
    const editorInstance = editorInstanceRef.current;
    if (!editorInstance) return;

    const uri = `file:///${modelId}.${language}`;
    const model = getOrCreateModel(uri, language, contents);

    editorInstance.setModel(model);

    // Listen to content changes on this model
    const disposable = model.onDidChangeContent(() => {
      onCodeModifiedRef.current(model.getValue());
    });

    return () => disposable.dispose();
  }, [modelId, language, contents]);

  // Handle Ctrl+S on the container
  useEffect(() => {
    const container = editorRef.current;
    if (!container) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        e.stopPropagation();

        const editorInstance = editorInstanceRef.current;
        if (!editorInstance) return;

        let code = editorInstance.getValue();

        if (autoFormat) {
          code = await PrettierFormatter.format(code, language);
          editorInstance.setValue(code);
        }

        onCodeSaved(code);
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [autoFormat, language, onCodeSaved]);

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
