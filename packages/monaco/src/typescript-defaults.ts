import { TypeScriptCompilerOptions } from "@shared/typescript";
import { SharedScriptInfo } from "@shared/model";
import monaco from "monaco-editor";
import { generateSharedScriptDeclaration } from "./typescript-declarations";

/**
 * The TypeScript contribution module is imported directly by its ESM subpath.
 * The `MonacoEditorWebpackPlugin` already imports this module as a side-effect
 * into the `editor.api.js` bundle, so the `typescriptDefaults` singleton is
 * guaranteed to be instantiated by the time this import resolves.
 *
 * The subpath has no usable type declarations — a type assertion via
 * `typeof typescript` is needed.
 */
import type { typescript } from "monaco-editor";
import * as _tsContribution from "monaco-editor/esm/vs/language/typescript/monaco.contribution";
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

// ── Shared Script Extra Lib Lifecycle ─────────────────────────────────────────

// Module-level disposable tracking — non-serializable, kept outside Redux state.
interface SharedLibEntry {
  disposable: { dispose(): void };
  sourceHash: string;
}
const sharedLibEntries = new Map<string, SharedLibEntry>();

/**
 * Syncs shared-script extra lib registrations with the provided list. Disposes
 * any libs whose source has changed or are no longer present, then registers
 * new/updated declarations so Monaco's TypeScript language service can resolve
 * `import { … } from "shared/…"`.
 */
export function syncSharedScriptLibs(sharedScripts: SharedScriptInfo[]): void {
  const currentIds = new Set(sharedScripts.map((s) => s.id));

  // Dispose libs for scripts that are no longer in the dependency list
  for (const [id, entry] of sharedLibEntries) {
    if (!currentIds.has(id)) {
      entry.disposable.dispose();
      sharedLibEntries.delete(id);
    }
  }

  // Register or update extra libs for each shared script
  for (const shared of sharedScripts) {
    if (!shared.moduleName) {
      console.warn(
        `Shared script '${shared.name}' is not a module for some reason`
      );
      continue;
    }

    const existing = sharedLibEntries.get(shared.id);

    // Skip if the source code hasn't changed
    if (existing && existing.sourceHash === shared.sourceCode) {
      continue;
    }

    // Dispose the previous registration if updating
    if (existing) {
      existing.disposable.dispose();
    }

    const declaration = generateSharedScriptDeclaration(
      shared.moduleName,
      shared.sourceCode
    );

    const disposable = addSharedScriptExtraLib(declaration, shared.moduleName);

    sharedLibEntries.set(shared.id, {
      disposable,
      sourceHash: shared.sourceCode,
    });
  }
}
