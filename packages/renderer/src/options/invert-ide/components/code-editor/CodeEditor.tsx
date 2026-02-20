import { FormatterLanguage, PrettierFormatter } from "@/sandbox/formatter";
import {
  addSharedScriptExtraLib,
  ensureTypescriptDefaults,
  getCodeEditorThemeName,
} from "@/shared/monaco/monaco";
import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";

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

/**
 * Generates a TypeScript declaration from shared script source code.
 * Extracts exported members so Monaco can provide intellisense for
 * `import { ... } from "shared/moduleName"`.
 */
function generateSharedScriptDeclaration(moduleName: string, sourceCode: string): string {
  const lines: string[] = [];
  lines.push(`declare module "shared/${moduleName}" {`);

  // Match exported const/let/var declarations
  const varRegex = /^export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*([^=;]+?))?\s*[=;]/gm;
  let match: RegExpExecArray | null;
  while ((match = varRegex.exec(sourceCode)) !== null) {
    const name = match[1];
    const type = match[2]?.trim() || "any";
    lines.push(`  export const ${name}: ${type};`);
  }

  // Match exported function declarations
  const fnRegex = /^export\s+function\s+(\w+)\s*(\([^)]*\))\s*(?::\s*([^{]+?))?\s*\{/gm;
  while ((match = fnRegex.exec(sourceCode)) !== null) {
    const name = match[1];
    const params = match[2];
    const returnType = match[3]?.trim() || "any";
    lines.push(`  export function ${name}${params}: ${returnType};`);
  }

  // Match exported class declarations
  const classRegex = /^export\s+class\s+(\w+)/gm;
  while ((match = classRegex.exec(sourceCode)) !== null) {
    const name = match[1];
    lines.push(`  export class ${name} {}`);
  }

  // Match exported type/interface declarations
  const typeRegex = /^export\s+(?:type|interface)\s+(\w+)/gm;
  while ((match = typeRegex.exec(sourceCode)) !== null) {
    const name = match[1];
    lines.push(`  export type ${name} = any;`);
  }

  lines.push("}");
  return lines.join("\n");
}

type SharedScriptInfo = {
  id: string;
  name: string;
  moduleName: string;
  sourceCode: string;
};

type CodeEditorProps = {
  modelId: string; /** Unique identifier for this editor's content (e.g., scriptId) */
  contents: string;
  language: FormatterLanguage;
  sharedScripts?: SharedScriptInfo[];
  settings?: {
    theme: string;
    autoFormat: boolean;
    fontSize: number;
  };
  onCodeModified: (value: string) => void;
  onCodeSaved: (value: string) => void;
};

export function CodeEditor(props: CodeEditorProps) {
  const { modelId, language, contents, sharedScripts, settings, onCodeModified, onCodeSaved } =
    props;

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
      theme: getCodeEditorThemeName(settings?.theme),
      fontSize: settings?.fontSize,
      automaticLayout: true,
      padding: { top: 25, bottom: 10 },
      fixedOverflowWidgets: true,
      wordWrap: "on",
      minimap: { enabled: false },
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      scrollbar: {
        vertical: "hidden",
        horizontal: "hidden",
        useShadows: false,
        verticalScrollbarSize: 0,
        horizontalScrollbarSize: 0,
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
    monaco.editor.setTheme(getCodeEditorThemeName(settings?.theme));
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
    }

    // Listen to content changes on this model
    const disposable = model.onDidChangeContent(() => {
      onCodeModifiedRef.current(model.getValue());
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

  // Handle Ctrl+S on the container
  useEffect(() => {
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

        let code = editorInstance.getValue();

        if (settings?.autoFormat) {
          code = await PrettierFormatter.format(code, language);
          editorInstance.setValue(code);
        }

        onCodeSaved(code);
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [settings?.autoFormat, language, onCodeSaved]);

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
