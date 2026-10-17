import type { ExecutionRequest } from "./execution-adapter";
type UserScriptsApi = Pick<typeof chrome.userScripts, "getScripts" | "execute">;
export async function detectExecutionCapability(
  api: UserScriptsApi | undefined = chrome.userScripts
): Promise<"ready" | "permission-required" | "unsupported"> {
  if (!api?.execute) {
    return "permission-required";
  }
  try {
    await api.getScripts();
    return "ready";
  } catch {
    return "permission-required";
  }
}
export async function executeUserScript(
  request: ExecutionRequest,
  api: UserScriptsApi | undefined = chrome.userScripts,
  timeoutMs = 30000
): Promise<void> {
  if ((await detectExecutionCapability(api)) !== "ready") {
    throw new Error(
      "Enable Allow User Scripts in this extension's Chrome details, then retry."
    );
  }
  if (!request.code.trim()) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Chromium can return { result: null } for thrown code without an error field.
  // A completion marker distinguishes that from successful void scripts without
  // adding a function/block scope around classic scripts or CDN globals.
  const code = request.awaitCompletion
    ? `(${request.code.trim().replace(/;+\s*$/, "")}).then(() => true)`
    : request.code + "\n;true;";
  const execution = api.execute({
    target: {
      tabId: request.tabId,
      ...(request.documentId ? { documentIds: [request.documentId] } : {}),
    },
    world: "MAIN",
    injectImmediately: request.injectImmediately ?? false,
    js: [{ code }],
  });
  let results: Awaited<typeof execution>;
  try {
    results = await Promise.race([
      execution,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          const error = new Error(
            "Script execution has not completed. Its outcome is unknown; reapply explicitly if needed."
          );
          error.name = "UnknownExecutionError";
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  const failed = results.find((result) => result.error);
  if (failed) {
    throw new Error(failed.error);
  }
  if (!results.length || results.some((result) => result.result !== true)) {
    throw new Error(
      "Script execution failed before completion. Check the page console for the original error."
    );
  }
}
