import { SharedScriptInfo, Userscript } from "@shared/model";
import { TypeScriptCompilerOptions } from "@shared/typescript";
import monaco from "monaco-editor";
import ts from "typescript";
import { generateSharedScriptDeclaration } from "./declarations";
import { fetchModuleTypes } from "./cdn-types";

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
import * as _tsContribution from "monaco-editor/esm/vs/language/typescript/monaco.contribution.js";

const tsContribution = _tsContribution as unknown as typeof typescript;

// ── TypeScript Defaults Configuration ─────────────────────────────────────────

let configured = false;

/**
 * Configures the TypeScript language service compiler options once. Because the
 * contribution module is imported directly above, its exports are available
 * immediately — no lazy-load polling is required.
 */
export function ensureTypescriptDefaults(): void {
  if (configured) {
    return;
  }

  configured = true;

  tsContribution.typescriptDefaults.setCompilerOptions({
    ...TypeScriptCompilerOptions,
    module: TypeScriptCompilerOptions.module.valueOf(),
    target: TypeScriptCompilerOptions.target.valueOf(),
    moduleResolution: tsContribution.ModuleResolutionKind.NodeJs,
    // Each userscript editor model should type-check as an isolated module, even
    // when Monaco keeps other script models alive for tab switching.
    moduleDetection: ts.ModuleDetectionKind.Force,
    // Allow `import { x } from "shared/moduleName"` to resolve to the extra lib
    // registered at `node_modules/shared/<moduleName>/index.d.ts`, and ensure
    // TypeScript's auto-import generates the `shared/*` specifier rather than a
    // relative path to a physical model file.
    //
    // baseUrl must be "file:///" (the virtual FS root) so that the paths entries
    // below resolve against the correct virtual directory. Using "." would resolve
    // relative to each individual file's directory, causing node_modules lookups
    // to fail silently.
    baseUrl: "file:///",
    paths: {
      "shared/*": ["node_modules/shared/*/index.d.ts"],
    },
  });

  // Re-enable eager model sync so the TypeScript worker is notified whenever a
  // model is disposed. This is essential for the shared-script model disposal in
  // TypeScriptCodeEditor to take effect: when model.dispose() is called, Monaco
  // fires onWillDisposeModel which the worker uses to remove that file from its
  // program. Without this, the worker retains a stale copy of the shared script
  // and continues to offer relative-UUID import paths.
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
  packageJsonDisposable: { dispose(): void };
  sourceHash: string;
}
const sharedLibEntries = new Map<string, SharedLibEntry>();

/**
 * Includes `moduleName` so a rename triggers re-registration at the new path.
 */
function buildSharedLibSourceHash(shared: SharedScriptInfo): string {
  return JSON.stringify([
    shared.moduleName,
    shared.sourceCode,
    shared.typeDefinitions,
  ]);
}

/**
 * Registers a minimal `package.json` at the conventional
 * `node_modules/shared/<moduleName>/package.json` virtual path so that
 * TypeScript's auto-import path computation can determine the package name and
 * suggest `import { X } from "shared/<moduleName>"` instead of a relative path.
 *
 * Without this entry, TypeScript has no way to map the extra-lib declaration
 * file back to a named package — it falls back to a relative path that
 * references the raw model URI (`../<uuid>/main`).
 */
function addSharedScriptPackageJson(moduleName: string): monaco.IDisposable {
  const packageJson = JSON.stringify({
    name: `shared/${moduleName}`,
    types: "./index.d.ts",
  });
  const filePath = `file:///node_modules/shared/${moduleName}/package.json`;
  return tsContribution.typescriptDefaults.addExtraLib(packageJson, filePath);
}

interface AmbientTypeDefinitionLibInfo {
  id: string;
  filePath: string;
  contents: string;
}

interface AmbientTypeDefinitionEntry {
  disposable: { dispose(): void };
  sourceHash: string;
  filePath: string;
}

const ambientTypeDefinitionEntries = new Map<
  string,
  AmbientTypeDefinitionEntry
>();

export function toSharedScriptInfo(script: Userscript): SharedScriptInfo | null {
  const moduleName = script.moduleName.trim();

  if (!script.shared || moduleName.length === 0) {
    return null;
  }

  return {
    id: script.id,
    name: script.name,
    moduleName,
    sourceCode: script.code.source.typescript,
    typeDefinitions: script.typeDefinitions ?? "",
  };
}

/**
 * Registers extra libs for every shared userscript so the TypeScript worker can
 * resolve `import { … } from "shared/…"` before any editor model is created.
 * Call after userscripts load and whenever shared script sources change.
 */
export function syncAllSharedScriptLibsFromUserscripts(
  scripts: Iterable<Userscript>
): void {
  ensureTypescriptDefaults();

  const sharedScripts: SharedScriptInfo[] = [];

  for (const script of scripts) {
    const info = toSharedScriptInfo(script);

    if (info) {
      sharedScripts.push(info);
    }
  }

  syncSharedScriptLibs(sharedScripts);
}

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
      entry.packageJsonDisposable.dispose();
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
    const sourceHash = buildSharedLibSourceHash(shared);

    // Skip if the source code hasn't changed
    if (existing && existing.sourceHash === sourceHash) {
      continue;
    }

    // Dispose the previous registration if updating
    if (existing) {
      existing.disposable.dispose();
      existing.packageJsonDisposable.dispose();
    }

    const declaration = generateSharedScriptDeclaration(
      shared.moduleName,
      shared.sourceCode,
      shared.typeDefinitions
    );

    const disposable = addSharedScriptExtraLib(declaration, shared.moduleName);
    const packageJsonDisposable = addSharedScriptPackageJson(shared.moduleName);

    sharedLibEntries.set(shared.id, {
      disposable,
      packageJsonDisposable,
      sourceHash,
    });
  }
}

function addAmbientTypeDefinitionExtraLib(
  declaration: string,
  filePath: string
): monaco.IDisposable {
  return tsContribution.typescriptDefaults.addExtraLib(declaration, filePath);
}

export function syncAmbientTypeDefinitionLibs(
  libs: AmbientTypeDefinitionLibInfo[]
): void {
  const currentIds = new Set(libs.map((lib) => lib.id));

  for (const [id, entry] of ambientTypeDefinitionEntries) {
    if (!currentIds.has(id)) {
      entry.disposable.dispose();
      ambientTypeDefinitionEntries.delete(id);
    }
  }

  for (const lib of libs) {
    const existing = ambientTypeDefinitionEntries.get(lib.id);

    if (
      existing &&
      existing.sourceHash === lib.contents &&
      existing.filePath === lib.filePath
    ) {
      continue;
    }

    if (existing) {
      existing.disposable.dispose();
    }

    const disposable = addAmbientTypeDefinitionExtraLib(
      lib.contents,
      lib.filePath
    );

    ambientTypeDefinitionEntries.set(lib.id, {
      disposable,
      sourceHash: lib.contents,
      filePath: lib.filePath,
    });
  }
}

// ── CDN Module Extra Lib Registration ─────────────────────────────────────────

export interface CdnModuleInfo {
  id: string;
  packageName: string;
}

interface CdnLibEntry {
  disposable: { dispose(): void };
  packageName: string;
}
const cdnLibEntries = new Map<string, CdnLibEntry>();

/**
 * Registers a CDN module's type declarations as an extra lib on the TypeScript
 * language service at the conventional `node_modules/<packageName>/index.d.ts`
 * path so that ambient globals from `@types/*` are visible to the editor.
 */
function addCdnModuleExtraLib(
  declaration: string,
  packageName: string
): monaco.IDisposable {
  const filePath = `file:///node_modules/@types/${packageName}/index.d.ts`;
  return tsContribution.typescriptDefaults.addExtraLib(declaration, filePath);
}

/**
 * Syncs CDN module extra lib registrations with the provided list. Fetches type
 * definitions from DefinitelyTyped for modules that have a `packageName`, then
 * registers them as extra libs. Disposes libs that are no longer in the list.
 */
export async function syncCdnModuleLibs(
  modules: CdnModuleInfo[]
): Promise<void> {
  const currentIds = new Set(modules.map((m) => m.id));

  // Dispose libs for modules no longer in the dependency list
  for (const [id, entry] of cdnLibEntries) {
    if (!currentIds.has(id)) {
      entry.disposable.dispose();
      cdnLibEntries.delete(id);
    }
  }

  // Register extra libs for each module with a package name
  for (const module of modules) {
    if (!module.packageName) {
      continue;
    }

    // Skip if already registered with the same package name
    const existing = cdnLibEntries.get(module.id);
    if (existing && existing.packageName === module.packageName) {
      continue;
    }

    // Dispose previous registration if updating
    if (existing) {
      existing.disposable.dispose();
    }

    const declaration = await fetchModuleTypes(module.packageName);

    if (!declaration) {
      continue;
    }

    const disposable = addCdnModuleExtraLib(declaration, module.packageName);

    cdnLibEntries.set(module.id, {
      disposable,
      packageName: module.packageName,
    });
  }
}
