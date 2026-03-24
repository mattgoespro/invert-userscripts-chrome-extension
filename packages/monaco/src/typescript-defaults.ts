import { TypeScriptCompilerOptions } from "@shared/typescript";
import monaco from "monaco-editor";

/**
 * The webpack alias resolves the bare "monaco-editor" specifier to the slim
 * `editor.api` entry, which does not bundle or register the TypeScript language
 * contribution. The "monaco-editor-ts-contribution" alias maps directly to the
 * contribution module so `typescriptDefaults`, `ModuleResolutionKind`, and other
 * TS-specific exports are available at module-load time.
 *
 * The contribution module has no usable type declarations — a type assertion
 * via `typeof typescript` is needed.
 */
import type { typescript } from "monaco-editor";
import * as _tsContribution from "monaco-editor-ts-contribution";
const tsContribution = _tsContribution as unknown as typeof typescript;

// ── TypeScript Defaults Configuration ─────────────────────────────────────────

let configured = false;

/**
 * Configures the TypeScript language service compiler options once. Because the
 * contribution module is imported directly above, its exports are available
 * immediately — no lazy-load polling is required.
 *
 * @param signal - An AbortSignal to skip configuration (e.g. on component unmount).
 */
export async function ensureTypescriptDefaults(
  signal?: AbortSignal
): Promise<void> {
  if (configured || signal?.aborted) {
    return;
  }

  configured = true;

  tsContribution.typescriptDefaults.setCompilerOptions({
    ...TypeScriptCompilerOptions,
    module: TypeScriptCompilerOptions.module.valueOf(),
    target: TypeScriptCompilerOptions.target.valueOf(),
    moduleResolution: tsContribution.ModuleResolutionKind.NodeJs,
  });

  tsContribution.typescriptDefaults.setEagerModelSync(true);
}

// ── Shared Script Extra Lib Registration ──────────────────────────────────────

/**
 * Registers a shared script declaration as an extra lib on the TypeScript
 * language service so the worker's module resolution can discover it at the
 * conventional `node_modules/shared/<moduleName>/index.d.ts` path.
 *
 * Extra libs — unlike standalone editor models — are explicitly pushed to the
 * TypeScript web worker. Models created via `monaco.editor.createModel()` are
 * only mirrored to the worker when diagnostics are requested for them, so they
 * cannot be found by the worker's `fileExists()` during module resolution.
 */
export function addSharedScriptExtraLib(
  declaration: string,
  moduleName: string
): monaco.IDisposable {
  const filePath = `file:///node_modules/shared/${moduleName}/index.d.ts`;
  return tsContribution.typescriptDefaults.addExtraLib(declaration, filePath);
}
