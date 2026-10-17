import { transpileModule } from "typescript";
import { TypeScriptCompilerOptions } from "@shared/typescript";
import { prepareCompiledJavascript } from "@shared/compiled-output";
import { minifyUserscript } from "./minifier";
import { analyzeModule, getAsyncCompletionExpression } from "./module-analysis";
import type { ModuleManifest } from "@shared/modules/manifest";

interface BuildWorkerRequest {
  type: "compile";
  id: string;
  sourceCode: string;
  shared?: boolean;
  moduleName?: string;
  minify?: boolean;
  analysisOnly?: boolean;
}

interface BuildWorkerResponse {
  manifest?: ModuleManifest;
  type: "compile-result" | "worker-ready";
  id?: string;
  success?: boolean;
  code?: string;
  error?: string;
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
      });

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
