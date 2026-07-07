import { TypeScriptCompilerOptions } from "@shared/typescript";
import type * as monaco from "monaco-editor";

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

  // The shared options object is typed against the full TypeScript compiler's
  // enums; Monaco re-declares numerically identical enums, hence the cast.
  const sharedOptions = TypeScriptCompilerOptions as unknown as Parameters<
    typeof tsContribution.typescriptDefaults.setCompilerOptions
  >[0];

  tsContribution.typescriptDefaults.setCompilerOptions({
    ...sharedOptions,
    moduleResolution: tsContribution.ModuleResolutionKind.NodeJs,
    // Each userscript source model type-checks as an isolated module even when
    // it contains no imports/exports. Declaration files (.d.ts) are unaffected
    // by moduleDetection, so a types pane without exports stays ambient/global.
    moduleDetection: 3 /* ts.ModuleDetectionKind.Force */,
    // Resolve `import { x } from "scripts/<module>/main"` against the real
    // source models living at `file:///scripts/<module>/main.ts` — the
    // "file:///" baseUrl anchors the `paths` patterns at the virtual FS root.
    baseUrl: "file:///",
    paths: { "scripts/*/*": ["scripts/*/*"] },
  });

  // Eager model sync mirrors every live model into the TypeScript worker, so
  // real script models participate in the program as actual files (module
  // resolution, cross-file diagnostics, auto-import) without extra libs. It
  // also notifies the worker when models are disposed, keeping the program
  // free of stale files after script deletion or rename.
  tsContribution.typescriptDefaults.setEagerModelSync(true);

  // With every script mirrored into the worker, restrict marker computation to
  // models attached to a visible editor. The full program stays available for
  // module resolution; diagnostics simply are not computed for closed files.
  tsContribution.typescriptDefaults.setDiagnosticsOptions({
    onlyVisible: true,
  });
}

// ── Module package.json Registration ──────────────────────────────────────────

/**
 * Registers a minimal `package.json` at `scripts/<modulePath>/package.json` so
 * TypeScript's module-specifier computation names the package `scripts/<m>`
 * and auto-import suggests the canonical `scripts/<m>/main` specifier instead
 * of a relative path. Content is static per module path — it only changes when
 * a script is renamed, never per keystroke.
 */
const modulePackageJsonEntries = new Map<string, monaco.IDisposable>();

function buildModulePackageJson(modulePath: string): string {
  return JSON.stringify({
    name: `scripts/${modulePath}`,
    exports: {
      "./main": "./main.ts",
      "./types": "./types.d.ts",
    },
  });
}

export function syncModulePackageJsons(modulePaths: string[]): void {
  const desired = new Set(modulePaths);

  for (const [modulePath, disposable] of modulePackageJsonEntries) {
    if (!desired.has(modulePath)) {
      disposable.dispose();
      modulePackageJsonEntries.delete(modulePath);
    }
  }

  for (const modulePath of desired) {
    if (modulePackageJsonEntries.has(modulePath)) {
      continue;
    }

    const disposable = tsContribution.typescriptDefaults.addExtraLib(
      buildModulePackageJson(modulePath),
      `file:///scripts/${modulePath}/package.json`
    );

    modulePackageJsonEntries.set(modulePath, disposable);
  }
}

// ── Ambient Type Definition Libs ──────────────────────────────────────────────

export interface AmbientTypeDefinitionLibInfo {
  id: string;
  filePath: string;
  contents: string;
}

interface AmbientTypeDefinitionEntry {
  disposable: monaco.IDisposable;
  sourceHash: string;
  filePath: string;
}

const ambientTypeDefinitionEntries = new Map<
  string,
  AmbientTypeDefinitionEntry
>();

/**
 * Syncs ambient (globally-visible) type definition extra libs. Used for the
 * export-stripped copies of type panes that contain exports: the real
 * `types.d.ts` model is a module in that case, so its declarations are only
 * importable — the ambient copy keeps them globally visible as well.
 */
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

    const disposable = tsContribution.typescriptDefaults.addExtraLib(
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

// ── Generic Extra Lib Registration (type acquisition) ─────────────────────────

/**
 * Registers a declaration file on the TypeScript language service at the given
 * virtual path. Used by CDN type acquisition to install `@types` packages at
 * `node_modules/@types/<pkg>/...`.
 */
export function addTypeLib(
  contents: string,
  filePath: string
): monaco.IDisposable {
  return tsContribution.typescriptDefaults.addExtraLib(contents, filePath);
}

// ── Worker access ─────────────────────────────────────────────────────────────

export type TypeScriptWorkerAccessor = Awaited<
  ReturnType<typeof tsContribution.getTypeScriptWorker>
>;

/**
 * Resolves the TypeScript worker accessor from the language contribution.
 * Exposed here because the renderer imports Monaco through the
 * `editor.api.js` alias, which does not carry the top-level `typescript`
 * namespace export.
 */
export function getTypeScriptWorkerAccessor(): Promise<TypeScriptWorkerAccessor> {
  return tsContribution.getTypeScriptWorker();
}
