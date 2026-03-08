import {
  CompilerOptions,
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
} from "typescript";

export const TypeScriptCompilerOptions: CompilerOptions = {
  target: ScriptTarget.ES2020,
  module: ModuleKind.ESNext,
  moduleResolution: ModuleResolutionKind.Node10,
  esModuleInterop: true,
  allowJs: true,
  checkJs: true,
  strict: false,
  lib: ["es2020", "dom"],
  isolatedModules: true,
};
