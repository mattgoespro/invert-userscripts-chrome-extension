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

  // Enum values sourced from monaco.contribution.js:
  //   ScriptTarget.ES2020 = 7, ModuleKind.ESNext = 99, ModuleResolutionKind.NodeJs = 2
  tsDefaults.setCompilerOptions({
    ...TypeScriptCompilerOptions,
    module: TypeScriptCompilerOptions.module.valueOf(),
    target: TypeScriptCompilerOptions.target.valueOf(),
    moduleResolution: TypeScriptCompilerOptions.moduleResolution.valueOf(),
  });

  tsDefaults.setDiagnosticsOptions({
    // noSemanticValidation: false,
    noSyntaxValidation: false,
  });
}

/**
 * Generates a TypeScript declaration from shared script source code.
 * Extracts exported members so Monaco can provide intellisense for
 * `import { ... } from "shared/moduleName"`.
 */
export function generateSharedScriptDeclaration(moduleName: string, sourceCode: string): string {
  const lines: string[] = [];
  lines.push(`declare module "shared/${moduleName}" {`);

  let match: RegExpExecArray;

  // Match exported const/let/var declarations
  const varRegex = /^export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*([^=;]+?))?\s*[=;]/gm;

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
