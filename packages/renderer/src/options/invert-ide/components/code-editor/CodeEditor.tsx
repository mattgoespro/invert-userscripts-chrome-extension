import {
  addSharedScriptExtraLib,
  ensureTypescriptDefaults,
  generateSharedScriptDeclaration,
} from "@packages/monaco";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  saveEditorCode,
  selectSharedScriptsForUserscript,
  setTsDefaultsConfigured,
} from "@/shared/store/slices/editor.slice";
import { selectEditorSettings } from "@/shared/store/slices/settings.slice";
import { useEffect, useMemo, useRef } from "react";
import * as monaco from "monaco-editor";
import { EditorSettings } from "@shared/model";
import { FormatterLanguage } from "@/sandbox/formatter";

// Cache models by URI to preserve undo history and cursor position
const modelCache = new Map<string, monaco.editor.ITextModel>();

// Track extra lib disposables for shared scripts
const sharedLibDisposables = new Map<string, monaco.IDisposable>();

function getOrCreateModel(
  uri: string,
  language: string,
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

  // Keep callback ref in sync (needed for model change listener)
  useEffect(() => {
    onCodeModifiedRef.current = onCodeModified;
  }, [onCodeModified]);

  // Initialize editor once on mount
  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    const editorInstance = monaco.editor.create(editorRef.current, {
      theme: settings.theme,
      fontSize: settings?.fontSize,
      automaticLayout: true,
      padding: { top: 25, bottom: 10 },
      fixedOverflowWidgets: true,
      wordWrap: "on",
      minimap: { enabled: false },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      readOnly: !editable,
      domReadOnly: !editable,
      cursorStyle: editable ? "line" : "underline-thin",
      cursorBlinking: editable ? "blink" : "solid",
      cursorWidth: editable ? undefined : 0,
      renderLineHighlight: "none",
      matchBrackets: editable ? "always" : "never",
      occurrencesHighlight: editable ? "singleFile" : "off",
      selectionHighlight: editable,
      scrollBeyondLastLine: editable,
      lineNumbers: editable ? "on" : "off",
      scrollbar: {
        vertical: "hidden",
        horizontal: "hidden",
        useShadows: false,
        verticalScrollbarSize: 0,
        horizontalScrollbarSize: 0,
        handleMouseWheel: editable,
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
    monaco.editor.setTheme(settings?.theme);
  }, [settings?.theme]);

  // Update font size dynamically without recreating the editor
  useEffect(() => {
    editorInstanceRef.current?.updateOptions({ fontSize: settings?.fontSize });
  }, [settings?.fontSize]);

  // Swap model when modelId changes (switching scripts)
  useEffect(() => {
    const editorInstance = editorInstanceRef.current;

    if (!editorInstance) {
      return;
    }

    const uri = `file:///${modelId}.${language}`;
    const model = getOrCreateModel(uri, language, contents);

    editorInstance.setModel(model);

    // Setting a TypeScript model triggers the contribution module to load,
    // which populates monaco.languages.typescript. Configure compiler options
    // now that they're guaranteed to be available.
    if (language === "typescript") {
      ensureTypescriptDefaults();
      dispatch(setTsDefaultsConfigured());
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

    // Dispose previous shared lib registrations
    for (const [key, disposable] of sharedLibDisposables) {
      disposable.dispose();
      sharedLibDisposables.delete(key);
    }

    // Register ambient module declarations for each shared script
    for (const shared of sharedScripts) {
      if (!shared.moduleName) {
        continue;
      }
      const declaration = generateSharedScriptDeclaration(shared.moduleName, shared.sourceCode);
      const filePath = `file:///node_modules/@types/shared/${shared.moduleName}/index.d.ts`;
      const disposable = addSharedScriptExtraLib(declaration, filePath);
      sharedLibDisposables.set(shared.id, disposable);
    }

    return () => {
      for (const [key, disposable] of sharedLibDisposables) {
        disposable.dispose();
        sharedLibDisposables.delete(key);
      }
    };
  }, [language, sharedScripts]);

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
