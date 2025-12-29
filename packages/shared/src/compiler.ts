import ts from 'typescript';
import { CompileResult } from './model';

export class TypeScriptCompiler {
  static compile(code: string): CompileResult {
    try {
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        allowJs: true,
      };

      const result = ts.transpileModule(code, {
        compilerOptions,
      });

      const warnings: string[] = [];

      if (result.diagnostics && result.diagnostics.length > 0) {
        result.diagnostics.forEach((diagnostic) => {
          if (diagnostic.file && diagnostic.start !== undefined) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
              diagnostic.start
            );
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            warnings.push(`Line ${line + 1}, Col ${character + 1}: ${message}`);
          } else {
            warnings.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
          }
        });
      }

      return {
        success: true,
        code: result.outputText,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown compilation error',
      };
    }
  }

  static typeCheck(code: string, fileName: string = 'script.ts'): string[] {
    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    };

    const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2020, true);
    const program = ts.createProgram([fileName], compilerOptions, {
      getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
      writeFile: () => {},
      getCurrentDirectory: () => '',
      getDirectories: () => [],
      fileExists: () => true,
      readFile: () => '',
      getCanonicalFileName: (name) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      getDefaultLibFileName: () => 'lib.d.ts',
    });

    const diagnostics = ts.getPreEmitDiagnostics(program);
    const errors: string[] = [];

    diagnostics.forEach((diagnostic) => {
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        errors.push(`Line ${line + 1}, Col ${character + 1}: ${message}`);
      } else {
        errors.push(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      }
    });

    return errors;
  }
}
