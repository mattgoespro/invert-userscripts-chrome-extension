import { TypeScriptCompilerOptions } from "@shared/typescript";
import monaco, { type typescript } from "monaco-editor";

export function getTypescriptDefaults(): typescript.LanguageServiceDefaults | null {
  const ts = monaco.typescript;

  if (!ts?.typescriptDefaults) {
    return null;
  }

  return ts?.typescriptDefaults;
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
}

/**
 * Generates a TypeScript declaration from shared script source code.
 * Extracts exported members so Monaco can provide intellisense for
 * `import { ... } from "shared/moduleName"`.
 */
export function generateSharedScriptDeclaration(
  moduleName: string,
  sourceCode: string
): string {
  const lines: string[] = [];

  let match: RegExpExecArray;

  // Match exported const/let/var declarations
  const varRegex =
    /^export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*([^=;]+?))?\s*[=;]/gm;

  while ((match = varRegex.exec(sourceCode)) !== null) {
    const name = match[1];
    const type = match[2]?.trim() || "any";
    lines.push(`export declare const ${name}: ${type};`);
  }

  // Match exported function declarations
  const fnRegex =
    /^export\s+function\s+(\w+)\s*(\([^)]*\))\s*(?::\s*([^{]+?))?\s*\{/gm;

  while ((match = fnRegex.exec(sourceCode)) !== null) {
    const name = match[1];
    const params = match[2];
    const returnType = match[3]?.trim() || "any";
    lines.push(`export declare function ${name}${params}: ${returnType};`);
  }

  // Match exported class declarations
  const classRegex = /^export\s+class\s+(\w+)/gm;

  while ((match = classRegex.exec(sourceCode)) !== null) {
    const name = match[1];
    lines.push(`export declare class ${name} {}`);
  }

  // Match exported type/interface declarations
  const typeRegex = /^export\s+(?:type|interface)\s+(\w+)/gm;

  while ((match = typeRegex.exec(sourceCode)) !== null) {
    const name = match[1];
    lines.push(`export type ${name} = any;`);
  }

  return lines.join("\n");
}

/**
 * Registers a shared script declaration as an extra lib on the TypeScript
 * language service so the worker's module resolution can discover it at the
 * conventional `node_modules/shared/<moduleName>/index.d.ts` path.
 *
 * Extra libs — unlike standalone editor models — are explicitly pushed to the
 * TypeScript web worker.  Models created via `monaco.editor.createModel()` are
 * only mirrored to the worker when diagnostics are requested for them, so they
 * cannot be found by the worker's `fileExists()` during module resolution.
 */
export function addSharedScriptExtraLib(
  declaration: string,
  moduleName: string
): monaco.IDisposable {
  const tsDefaults = getTypescriptDefaults();

  if (!tsDefaults) {
    console.warn(
      `[Invert IDE] addSharedScriptExtraLib: typescriptDefaults not available for shared/${moduleName}. monaco.languages.typescript may not be loaded yet.`
    );
    return { dispose: () => {} };
  }

  const filePath = `file:///node_modules/shared/${moduleName}/index.d.ts`;
  return tsDefaults.addExtraLib(declaration, filePath);
}

/**
 * Logs a snapshot of the TypeScript worker state for debugging module resolution.
 * Inspects: compiler options, extra libs registered on defaults, and the file
 * names the worker reports (including extra libs pushed to it).
 */
export async function debugTypescriptWorkerState(): Promise<void> {
  const tsDefaults = getTypescriptDefaults();

  if (!tsDefaults) {
    console.warn("[Invert IDE] TypeScript defaults not available");
    return;
  }

  const extraLibs = tsDefaults.getExtraLibs();
  const compilerOptions = tsDefaults.getCompilerOptions();

  console.group("[Invert IDE] TypeScript Worker Diagnostic");
  console.log("Compiler options:", compilerOptions);
  console.log("Extra libs (main thread):", extraLibs);
  console.log("Extra lib keys:", Object.keys(extraLibs));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getWorker = await (
      monaco.languages.typescript as any
    ).getTypeScriptWorker();
    const models = monaco.editor.getModels();
    const tsModel = models.find((m) => m.getLanguageId() === "typescript");

    console.log(
      "All models:",
      models.map((m) => ({
        uri: m.uri.toString(),
        language: m.getLanguageId(),
      }))
    );

    if (tsModel) {
      const worker = await getWorker(tsModel.uri);
      const scriptFileNames = await worker.getScriptFileNames();
      const sharedFiles = scriptFileNames.filter((name: string) =>
        name.includes("shared/")
      );

      console.log("Worker script file names (total):", scriptFileNames.length);
      console.log("Worker script file names (shared):", sharedFiles);
      console.log("All worker script file names:", scriptFileNames);
    } else {
      console.warn("No TypeScript model found");
    }
  } catch (error) {
    console.error("Worker inspection failed:", error);
  }

  console.groupEnd();
}
