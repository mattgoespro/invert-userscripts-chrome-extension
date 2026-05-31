import { transpileModule } from "typescript";
import { TypeScriptCompilerOptions } from "@shared/typescript";
import {
  CompiledCodeBuildMetadata,
  CompiledCodeEntry,
  EditorSettings,
  Userscript,
  UserscriptCompileResult,
} from "@shared/model";
import { prepareCompiledJavascript } from "@shared/compiled-output";
import { minify as minifyJavascript } from "terser";

export interface CompiledOutputBuildOptions {
  minifyCompiledOutput: boolean;
}

export function getCompiledOutputBuildOptions(
  settings: Partial<EditorSettings>
): CompiledOutputBuildOptions {
  return {
    minifyCompiledOutput: settings.minifyCompiledOutput ?? false,
  };
}

export function createCompiledCodeBuildMetadata(
  options: CompiledOutputBuildOptions
): CompiledCodeBuildMetadata {
  return {
    version: 1,
    minifyCompiledOutput: options.minifyCompiledOutput,
  };
}

export function isCompiledCodeBuildCurrent(
  entry: CompiledCodeEntry | null | undefined,
  options: CompiledOutputBuildOptions
): boolean {
  return (
    entry?.build?.version === 1 &&
    entry.build.minifyCompiledOutput === options.minifyCompiledOutput
  );
}

export class TypeScriptCompiler {
  static compile(code: string): UserscriptCompileResult {
    try {
      const result = transpileModule(code, {
        compilerOptions: TypeScriptCompilerOptions,
      });

      return {
        success: true,
        code: result.outputText,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error("Unknown compilation error"),
      };
    }
  }
}

async function minifyCompiledJavascript(
  code: string
): Promise<UserscriptCompileResult> {
  try {
    const result = await minifyJavascript(code, {
      compress: true,
      ecma: 2020,
      format: {
        comments: false,
      },
      mangle: true,
    });

    return {
      success: true,
      code: result.code ?? "",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error
          : new Error("Unknown JavaScript minification error"),
    };
  }
}

export async function buildUserscriptJavascript(
  script: Pick<Userscript, "shared" | "moduleName">,
  sourceCode: string,
  options: CompiledOutputBuildOptions
): Promise<UserscriptCompileResult> {
  const compiled = TypeScriptCompiler.compile(sourceCode);

  if (!compiled.success) {
    return compiled;
  }

  let code = prepareCompiledJavascript(compiled.code ?? "", {
    shared: script.shared,
    moduleName: script.moduleName,
  });

  if (!options.minifyCompiledOutput) {
    return {
      success: true,
      code,
    };
  }

  const minified = await minifyCompiledJavascript(code);

  if (!minified.success) {
    return minified;
  }

  code = minified.code ?? "";

  return {
    success: true,
    code,
  };
}

export async function buildUserscriptStylesheet(
  sourceCode: string,
  options: CompiledOutputBuildOptions
): Promise<UserscriptCompileResult> {
  return SassCompiler.compile(sourceCode, {
    minify: options.minifyCompiledOutput,
  });
}

export function buildCompiledCodeEntry(
  javascript: string,
  css: string,
  options: CompiledOutputBuildOptions
): CompiledCodeEntry {
  return {
    javascript,
    css,
    build: createCompiledCodeBuildMetadata(options),
  };
}

interface SassCompileRequest {
  type: "compile";
  id: string;
  scss: string;
  minify?: boolean;
}

interface SassCompileResponse {
  type: "compile-result" | "sandbox-ready";
  id?: string;
  success?: boolean;
  css?: string;
  error?: string;
}

/**
 * SASS Compiler that uses a sandboxed iframe to run dart-sass.
 *
 * Chrome Extensions have strict CSP that blocks 'unsafe-eval', which dart-sass requires.
 * By running the compiler in a sandboxed iframe with relaxed CSP, we can use dart-sass.
 */
export class SassCompiler {
  private static iframe: HTMLIFrameElement = null;
  private static isReady = false;
  private static readyPromise: Promise<void> = null;
  private static pendingRequests = new Map<
    string,
    { resolve: (result: UserscriptCompileResult) => void }
  >();

  /**
   * Initialize the sandboxed iframe for SASS compilation.
   * Call this once when the application starts.
   */
  static initialize(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = new Promise((resolve, reject) => {
      this.iframe = document.createElement("iframe");
      this.iframe.src = "/sass-sandbox.html";
      this.iframe.style.display = "none";

      // Reject initialization if the sandbox doesn't respond within 15 seconds.
      // Without this guard, any compile() call would hang indefinitely if the
      // sandbox page fails to load (404, CSP violation, JS error, etc.).
      const initTimeout = setTimeout(() => {
        this.readyPromise = null;
        reject(
          new Error("SCSS sandbox failed to initialize within 15 seconds.")
        );
      }, 15000);

      const handleMessage = (event: MessageEvent<SassCompileResponse>) => {
        if (event.source !== this.iframe.contentWindow) {
          return;
        }

        if (event.data?.type === "sandbox-ready") {
          clearTimeout(initTimeout);
          this.isReady = true;
          resolve();
          return;
        }

        if (event.data?.type === "compile-result" && event.data.id) {
          const pending = this.pendingRequests.get(event.data.id);

          if (pending) {
            this.pendingRequests.delete(event.data.id);

            if (event.data.success) {
              pending.resolve({
                success: true,
                code: event.data.css,
              });
            } else {
              pending.resolve({
                success: false,
                error: new Error(
                  event.data.error ?? "Unknown SCSS compilation error"
                ),
              });
            }
          }
        }
      };

      window.addEventListener("message", handleMessage);
      document.body.appendChild(this.iframe);
    });

    return this.readyPromise;
  }

  /**
   * Compile SCSS to CSS using the sandboxed dart-sass compiler.
   */
  static async compile(
    scss: string,
    options: { minify?: boolean } = {}
  ): Promise<UserscriptCompileResult> {
    if (!this.isReady || !this.iframe?.contentWindow) {
      try {
        await this.initialize();
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error
              : new Error("SCSS sandbox initialization failed."),
        };
      }
    }

    return new Promise((resolve) => {
      const id = crypto.randomUUID();

      this.pendingRequests.set(id, { resolve });

      const request: SassCompileRequest = {
        type: "compile",
        id,
        scss,
        minify: options.minify ?? false,
      };

      this.iframe!.contentWindow!.postMessage(request, "*");

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({
            success: false,
            error: new Error("SCSS compilation timed out."),
          });
        }
      }, 10000);
    });
  }
}
