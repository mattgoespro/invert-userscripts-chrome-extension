import { transpileModule } from "typescript";
import { TypeScriptCompilerOptions } from "@shared/typescript";
import { prepareCompiledJavascript } from "@shared/compiled-output";
import { minify as minifyJavascript } from "terser";

interface BuildWorkerRequest {
  type: "compile";
  id: string;
  sourceCode: string;
  shared?: boolean;
  moduleName?: string;
  minify?: boolean;
}

interface BuildWorkerResponse {
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
      const transpiled = transpileModule(sourceCode, {
        compilerOptions: TypeScriptCompilerOptions,
      });

      let code = prepareCompiledJavascript(transpiled.outputText, {
        shared,
        moduleName,
      });

      if (minify) {
        const result = await minifyJavascript(code, {
          compress: true,
          ecma: 2020,
          format: { comments: false },
          mangle: true,
        });

        code = result.code ?? code;
      }

      const response: BuildWorkerResponse = {
        type: "compile-result",
        id,
        success: true,
        code,
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
