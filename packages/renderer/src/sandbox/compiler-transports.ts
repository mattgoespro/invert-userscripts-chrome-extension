import type { CompilerEvents, CompilerTransport } from "./compiler-requests";

interface JavascriptInput {
  sourceCode: string;
  shared?: boolean;
  moduleName?: string;
  minify?: boolean;
}

interface SassInput {
  scss: string;
  minify?: boolean;
}

interface CompilerResponse {
  type: string;
  id?: string;
  success?: boolean;
  code?: string;
  css?: string;
  error?: string;
}

/** Worker protocol and lifetime; compilation algorithms stay in build-worker. */
export function connectBuildWorker(
  events: CompilerEvents
): CompilerTransport<JavascriptInput> {
  const url =
    typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("build-worker.js")
      : new URL("/build-worker.js", window.location.origin).href;
  const worker = new Worker(url);
  const onMessage = (event: MessageEvent<CompilerResponse>): void => {
    if (event.data?.type === "worker-ready") {
      events.ready();
    } else if (event.data?.type === "compile-result" && event.data.id) {
      events.result(
        event.data.id,
        event.data.success
          ? { success: true, code: event.data.code }
          : {
              success: false,
              error: new Error(event.data.error ?? "Unknown compilation error"),
            }
      );
    }
  };
  const onError = (event: ErrorEvent): void => {
    events.failed(new Error(event.message || "Build worker failed."));
  };
  worker.addEventListener("message", onMessage);
  worker.addEventListener("error", onError);
  return {
    send: (id, input) => worker.postMessage({ type: "compile", id, ...input }),
    close: () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.terminate();
    },
  };
}

/** Sass still runs in the CSP sandbox; each listener belongs to one iframe. */
export function connectSassSandbox(
  events: CompilerEvents
): CompilerTransport<SassInput> {
  const iframe = document.createElement("iframe");
  iframe.src = "/sass-sandbox.html";
  iframe.style.display = "none";
  const onMessage = (event: MessageEvent<CompilerResponse>): void => {
    if (event.source !== iframe.contentWindow) {
      return;
    }
    if (event.data?.type === "sandbox-ready") {
      events.ready();
    } else if (event.data?.type === "compile-result" && event.data.id) {
      events.result(
        event.data.id,
        event.data.success
          ? { success: true, code: event.data.css }
          : {
              success: false,
              error: new Error(
                event.data.error ?? "Unknown SCSS compilation error"
              ),
            }
      );
    }
  };
  window.addEventListener("message", onMessage);
  try {
    document.body.appendChild(iframe);
  } catch (error) {
    window.removeEventListener("message", onMessage);
    iframe.remove();
    throw error;
  }
  return {
    send: (id, input) =>
      iframe.contentWindow!.postMessage({ type: "compile", id, ...input }, "*"),
    close: () => {
      window.removeEventListener("message", onMessage);
      iframe.remove();
    },
  };
}
