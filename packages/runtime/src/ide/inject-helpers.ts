/**
 * Helpers for MAIN-world injection that are unit-testable without chrome.
 */

/**
 * Compiled userscripts wrap top-level await as `(async () => { ... })();` or
 * `(async function(){ ... })();`. Only those completion values should be
 * awaited — a CDN bundle or classic script whose last expression is a
 * thenable must not stall the inject queue.
 *
 * Minify (Terser) may rewrite the wrapper as `!async function(){...}()`.
 */
export function shouldAwaitInjectedEvalResult(code: string): boolean {
  const trimmed = code.trimStart();
  // Terser may rewrite `(async () => { ... })();` as `!async function(){...}()`.
  return /^(?:void |[!+\-~])?(?:\(async|async(?:\s+function|\())/.test(trimmed);
}

export type IsolatedInjectTask = {
  label: string;
  run: () => Promise<void>;
};

export type IsolatedInjectResult = {
  succeeded: number;
  failed: Array<{ label: string; error: unknown }>;
};

/**
 * Run inject steps in order. A thrown step is recorded and the remaining
 * steps still run so one bad CDN/script cannot abort siblings.
 */
export async function runIsolatedInjectTasks(
  tasks: IsolatedInjectTask[]
): Promise<IsolatedInjectResult> {
  let succeeded = 0;
  const failed: IsolatedInjectResult["failed"] = [];

  for (const task of tasks) {
    try {
      await task.run();
      succeeded += 1;
    } catch (error) {
      failed.push({ label: task.label, error });
      console.error(`Error injecting ${task.label}:`, error);
    }
  }

  return { succeeded, failed };
}
