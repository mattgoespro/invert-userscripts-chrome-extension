import {
  transpileModule,
  CompilerOptions,
  ScriptTarget,
  ModuleKind,
  ModuleResolutionKind,
  createProgram,
  createSourceFile,
  flattenDiagnosticMessageText,
  getPreEmitDiagnostics,
} from "typescript";
import { CompileResult } from "./model";

export class TypeScriptCompiler {
  static compile(code: string): CompileResult {
    try {
      const compilerOptions: CompilerOptions = {
        target: ScriptTarget.ES2020,
        module: ModuleKind.ESNext,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: ModuleResolutionKind.Node10,
        allowJs: true,
      };

      const result = transpileModule(code, {
        compilerOptions,
      });

      return {
        success: true,
        code: result.outputText,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error("Unknown compilation error"),
      };
    }
  }

  static typeCheck(code: string, fileName: string = "script.ts"): string[] {
    const compilerOptions: CompilerOptions = {
      target: ScriptTarget.ES2020,
      module: ModuleKind.ESNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    };

    const sourceFile = createSourceFile(fileName, code, ScriptTarget.ES2020, true);
    const program = createProgram([fileName], compilerOptions, {
      getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
      writeFile: () => {},
      getCurrentDirectory: () => "",
      getDirectories: () => [],
      fileExists: () => true,
      readFile: () => "",
      getCanonicalFileName: (name) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
      getDefaultLibFileName: () => "lib.d.ts",
    });

    const diagnostics = getPreEmitDiagnostics(program);
    const errors: string[] = [];

    diagnostics.forEach((diagnostic) => {
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const message = flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        errors.push(`Line ${line + 1}, Col ${character + 1}: ${message}`);
      } else {
        errors.push(flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      }
    });

    return errors;
  }
}
