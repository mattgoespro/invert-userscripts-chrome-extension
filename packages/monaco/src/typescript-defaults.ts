import { TypeScriptCompilerOptions } from "@shared/typescript";
import monaco, { type typescript } from "monaco-editor";

/**
 * Returns the TypeScript language service defaults, or `null` if the TypeScript
 * contribution module has not yet been loaded by Monaco. That module loads
 * lazily when the first TypeScript model is created.
 */
function getTypescriptDefaults(): typescript.LanguageServiceDefaults | null {
  const ts = monaco.typescript;

  if (!ts?.typescriptDefaults) {
    return null;
  }

  return ts.typescriptDefaults;
}

/**
 * Lazily configures the TypeScript language service compiler and diagnostics options.
 * Must be called after a TypeScript editor model has been created, which triggers the
 * MonacoEditorWebpackPlugin's contribution module to load and populate
 * `monaco.languages.typescript`. Safe to call multiple times — only runs once.
 */
let configured = false;

export function ensureTypescriptDefaults(): void {
  if (configured) {
    return;
  }

  const tsDefaults = getTypescriptDefaults();

  if (!tsDefaults) {
    return;
  }

  configured = true;

  tsDefaults.setCompilerOptions({
    ...TypeScriptCompilerOptions,
    module: TypeScriptCompilerOptions.module.valueOf(),
    target: TypeScriptCompilerOptions.target.valueOf(),
    moduleResolution:
      TypeScriptCompilerOptions.moduleResolution.valueOf() as typescript.ModuleResolutionKind,
    allowNonTsExtensions: true,
    baseUrl: "file:///",
    paths: {
      "shared/*": ["node_modules/shared/*/index.d.ts"],
    },
  });

  tsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  tsDefaults.setEagerModelSync(true);
}

/**
 * Registers a shared script declaration as an extra lib on the TypeScript
 * language service so the worker's module resolution can discover it at the
 * conventional `node_modules/shared/<moduleName>/index.d.ts` path.
 *
 * Extra libs — unlike standalone editor models — are explicitly pushed to the
 * TypeScript web worker. Models created via `monaco.editor.createModel()` are
 * only mirrored to the worker when diagnostics are requested for them, so they
 * cannot be found by the worker's `fileExists()` during module resolution.
 */
export function addSharedScriptExtraLib(
  declaration: string,
  moduleName: string
): monaco.IDisposable {
  const filePath = `file:///node_modules/shared/${moduleName}/index.d.ts`;
  return monaco.typescript.typescriptDefaults.addExtraLib(
    declaration,
    filePath
  );
}
