import { transpileModule, CompilerOptions, ScriptTarget, ModuleKind } from "typescript";
import { CompileResult } from "../../../shared/src/model";

export class TypeScriptCompiler {
  static compile(code: string): CompileResult {
    try {
      const compilerOptions: CompilerOptions = {
        target: ScriptTarget.ES2020,
        module: ModuleKind.ESNext,
        strict: true,
        esModuleInterop: true,
        allowJs: true,
        checkJs: true,
        lib: ["es2020", "dom"],
        isolatedModules: true,
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
}

interface SassCompileRequest {
  type: "compile";
  id: string;
  scss: string;
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
  private static iframe: HTMLIFrameElement | null = null;
  private static isReady = false;
  private static readyPromise: Promise<void> | null = null;
  private static pendingRequests = new Map<string, { resolve: (result: CompileResult) => void }>();

  /**
   * Initialize the sandboxed iframe for SASS compilation.
   * Call this once when the application starts.
   */
  static initialize(): Promise<void> {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = new Promise((resolve) => {
      this.iframe = document.createElement("iframe");
      this.iframe.src = "/sass-sandbox.html";
      this.iframe.style.display = "none";
      this.iframe.setAttribute("sandbox", "allow-scripts");

      const handleMessage = (event: MessageEvent<SassCompileResponse>) => {
        if (event.data?.type === "sandbox-ready") {
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
                error: new Error(event.data.error ?? "Unknown SCSS compilation error"),
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
  static async compile(scss: string): Promise<CompileResult> {
    if (!this.isReady || !this.iframe?.contentWindow) {
      await this.initialize();
    }

    return new Promise((resolve) => {
      const id = crypto.randomUUID();

      this.pendingRequests.set(id, { resolve });

      const request: SassCompileRequest = {
        type: "compile",
        id,
        scss,
      };

      this.iframe!.contentWindow!.postMessage(request, "*");

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve({
            success: false,
            error: new Error("SCSS compilation timed out"),
          });
        }
      }, 10000);
    });
  }
}
