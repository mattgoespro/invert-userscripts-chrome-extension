import { compileString } from "sass";

interface SassCompileRequest {
  type: "compile";
  id: string;
  scss: string;
}

interface SassCompileResponse {
  type: "compile-result";
  id: string;
  success: boolean;
  css?: string;
  error?: string;
}

/**
 * Sandboxed SASS compiler.
 *
 * This script runs in an iframe with relaxed CSP that allows 'unsafe-eval',
 * enabling dart-sass to function. Communication happens via postMessage.
 */
window.addEventListener(
  "message",
  (event: MessageEvent<SassCompileRequest>) => {
    if (event.data?.type !== "compile") {
      return;
    }

    const { id, scss } = event.data;

    // Defer compilation to a separate task to avoid blocking the message handler.
    // dart-sass compileString() is synchronous and can take hundreds of milliseconds,
    // which triggers Chrome's "[Violation] 'message' handler took Xms" warning.
    setTimeout(() => {
      try {
        const result = compileString(scss);

        const response: SassCompileResponse = {
          type: "compile-result",
          id,
          success: true,
          css: result.css,
        };

        window.parent.postMessage(response, "*");
      } catch (error) {
        const response: SassCompileResponse = {
          type: "compile-result",
          id,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown SCSS compilation error",
        };

        window.parent.postMessage(response, "*");
      }
    }, 0);
  }
);

// Signal that the sandbox is ready
window.parent.postMessage({ type: "sandbox-ready" }, "*");
