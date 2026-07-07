import type { CompilerOptions } from "typescript";

/**
 * Compiler options shared by the Monaco TypeScript language service and the
 * build worker.
 *
 * Enum members are written as their numeric values (with the enum name in a
 * comment) instead of importing the `typescript` package: a runtime import
 * here would pull the entire ~3MB compiler into every bundle that touches
 * these options. The values are stable public API of the TypeScript compiler.
 */
export const TypeScriptCompilerOptions: CompilerOptions = {
  target: 7 /* ts.ScriptTarget.ES2020 */,
  module: 99 /* ts.ModuleKind.ESNext */,
  moduleResolution: 2 /* ts.ModuleResolutionKind.Node10 */,
  esModuleInterop: true,
  allowJs: true,
  checkJs: true,
  strict: false,
  isolatedModules: true,
};
