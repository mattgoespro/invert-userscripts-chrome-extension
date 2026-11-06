import {
  DiagnosticCategory,
  flattenDiagnosticMessageText,
  transpileModule,
  type Diagnostic,
} from "typescript";
import { TypeScriptCompilerOptions } from "@shared/typescript";
import { prepareCompiledJavascript } from "@shared/compiled-output";
import { minifyUserscript } from "./minifier";
import { analyzeModule, getAsyncCompletionExpression } from "./module-analysis";
import type { ModuleManifest } from "@shared/modules/manifest";
import { buildOwnDeclarations } from "./declaration-analysis";

interface BuildWorkerRequest {
  type: "compile";
  id: string;
  sourceCode: string;
  shared?: boolean;
  moduleName?: string;
  minify?: boolean;
  analysisOnly?: boolean;
  declarationsOnly?: boolean;
}

interface BuildWorkerResponse {
  manifest?: ModuleManifest;
  type: "compile-result" | "worker-ready";
  id?: string;
  success?: boolean;
  code?: string;
  error?: string;
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const message = flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (!diagnostic.file || diagnostic.start === undefined) {
    return message;
  }
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start
  );
  return `Line ${line + 1}, column ${character + 1}: ${message}`;
}

/**
 * Off-thread TypeScript transpile + shared-module transform + optional minify.
 *
 * Lazy-loaded as a dedicated webpack entry so the ~3MB TypeScript compiler
 * never lands in the main options-page bundle.
 */
self.addEventListener("message", (event: MessageEvent<BuildWorkerRequest>) => {
  if (event.data?.type !== "compile") {
    return;
  }

  const { id, sourceCode, shared, moduleName, minify } = event.data;

  void (async () => {
    try {
      if (event.data.declarationsOnly) {
        self.postMessage({
          type: "compile-result",
          id,
          success: true,
          code: buildOwnDeclarations(sourceCode),
        } satisfies BuildWorkerResponse);
        return;
      }
      if (event.data.analysisOnly) {
        self.postMessage({
          type: "compile-result",
          id,
          success: true,
          code: "",
          manifest: analyzeModule(sourceCode),
        } satisfies BuildWorkerResponse);
        return;
      }
      const transpiled = transpileModule(sourceCode, {
        compilerOptions: TypeScriptCompilerOptions,
        reportDiagnostics: true,
      });
      // transpileModule still emits for unparsable source, so its output cannot
      // be published as a successful build.
      const errors = (transpiled.diagnostics ?? []).filter(
        (diagnostic) => diagnostic.category === DiagnosticCategory.Error
      );
      if (errors.length > 0) {
        throw new Error(errors.map(formatDiagnostic).join("\n"));
      }

      let code = prepareCompiledJavascript(transpiled.outputText, {
        shared,
        moduleName,
      });

      if (minify) {
        code = await minifyUserscript(code);
      }
      // Drop only the outer expression's trailing semicolon/comments so the
      // execution adapter can chain completion without reparsing program text.
      code = getAsyncCompletionExpression(code) ?? code;

      const response: BuildWorkerResponse = {
        type: "compile-result",
        id,
        success: true,
        code,
        manifest: analyzeModule(sourceCode, code),
      };

      self.postMessage(response);
    } catch (error) {
      const response: BuildWorkerResponse = {
        type: "compile-result",
        id,
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown compilation error",
      };

      self.postMessage(response);
    }
  })();
});

self.postMessage({ type: "worker-ready" } satisfies BuildWorkerResponse);
