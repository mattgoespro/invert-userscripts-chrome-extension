import monaco from "monaco-editor";
import { type typescript } from "monaco-editor";
import { applyHighlighter } from "./theming";

function getTypescriptDefaults(): typescript.LanguageServiceDefaults | null {
  const ts = monaco.typescript;

  if (!ts?.typescriptDefaults) {
    return null;
  }

  return ts.typescriptDefaults;
}

// Cached initialization promise — ensures `registerMonaco()` only runs once and all callers await the same result.
let initPromise: Promise<void> | null = null;

/**
 * Initialize Shiki's TextMate tokenizer and wire it into Monaco.
 * Safe to call multiple times — subsequent calls return the same promise.
 * Must be awaited BEFORE creating any Monaco editor instances so that:
 * 1. Monarch tokenizers are blocked for Shiki-managed languages
 * 2. shikiToMonaco's monkey-patches of editor.create / editor.setTheme are installed
 * 3. Themes are defined and token providers are registered
 */
export function registerMonaco(): Promise<void> {
  if (!initPromise) {
    initPromise = applyHighlighter();
  }

  return initPromise;
}

/**
 * Lazily configures the TypeScript language service compiler and diagnostics options.
 * Must be called after a TypeScript editor model has been created, which triggers the
 * MonacoEditorWebpackPlugin's contribution module to load and populate
 * `monaco.languages.typescript`. Safe to call multiple times — only runs once.
 */
let tsDefaultsConfigured = false;

export function ensureTypescriptDefaults(): void {
  if (tsDefaultsConfigured) {
    return;
  }

  const tsDefaults = getTypescriptDefaults();

  if (!tsDefaults) {
    return;
  }

  tsDefaultsConfigured = true;

  // Enum values sourced from monaco.contribution.js:
  //   ScriptTarget.ES2020 = 7, ModuleKind.ESNext = 99, ModuleResolutionKind.NodeJs = 2
  tsDefaults.setCompilerOptions({
    target: 7 /* ES2020 */,
    module: 99 /* ESNext */,
    moduleResolution: 2 /* NodeJs */,
    allowJs: true,
    strict: true,
    esModuleInterop: true,
    lib: ["es2020", "dom"],
  });

  tsDefaults.setDiagnosticsOptions({
    // noSemanticValidation: false,
    noSyntaxValidation: false,
  });
}

/**
 * Register an ambient module declaration as an extra lib in Monaco's TypeScript
 * language service. Returns a disposable that removes it.
 */
const noopDisposable: monaco.IDisposable = { dispose: () => {} };

export function addSharedScriptExtraLib(declaration: string, filePath: string): monaco.IDisposable {
  const tsDefaults = getTypescriptDefaults();

  if (!tsDefaults) {
    return noopDisposable;
  }

  return tsDefaults.addExtraLib(declaration, filePath);
}
