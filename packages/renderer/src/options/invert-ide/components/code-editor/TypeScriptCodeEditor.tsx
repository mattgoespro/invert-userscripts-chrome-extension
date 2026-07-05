import { useAppSelector } from "@/shared/store/hooks";
import { selectModules } from "@/shared/store/slices/modules";
import {
  selectAllSharedScriptInfos,
  selectGlobalModuleIdsForUserscript,
} from "@/shared/store/slices/code-editor";
import {
  ensureTypescriptDefaults,
  syncAmbientTypeDefinitionLibs,
  syncCdnModuleLibs,
  syncSharedScriptLibs,
} from "@packages/monaco";
import type { CdnModuleInfo } from "@packages/monaco";
import {
  buildModelUri,
  setSuppressedModelUris,
} from "./model-cache";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { CodeEditor, CodeEditorProps } from "../../shared/CodeEditor";
import { registerTypeScriptQuickFixProvider } from "@/shared/utils/quick-fix-provider";
import { registerImportIntelligence } from "@/shared/utils/import-intelligence";

/**
 * TypeScript-specific wrapper around {@link CodeEditor} that configures Monaco's
 * TypeScript language service defaults, and synchronizes shared script type
 * declarations and CDN module type definitions for intellisense.
 */
export function TypeScriptCodeEditor(
  props: Omit<CodeEditorProps, "language">
) {
  const { scriptId, ...rest } = props;
  const allSharedScripts = useAppSelector(selectAllSharedScriptInfos);
  const sharedScriptsForLanguageService = useMemo(
    () => allSharedScripts.filter((shared) => shared.id !== scriptId),
    [allSharedScripts, scriptId]
  );
  const globalModuleIds = useAppSelector(
    useMemo(() => selectGlobalModuleIdsForUserscript(scriptId), [scriptId])
  );
  const modulesMap = useAppSelector(selectModules);

  const cdnModules = useMemo<CdnModuleInfo[]>(() => {
    if (!globalModuleIds?.length) {
      return [];
    }

    return globalModuleIds
      .map((id) => modulesMap[id])
      .filter((m) => m?.packageName)
      .map((m) => ({ id: m.id, packageName: m.packageName! }));
  }, [globalModuleIds, modulesMap]);

  // Register other shared scripts' extra libs before the child CodeEditor
  // useEffect creates a model and triggers the first TypeScript diagnostic pass.
  // useLayoutEffect runs after DOM updates but before child passive effects.
  useLayoutEffect(() => {
    ensureTypescriptDefaults();
    syncSharedScriptLibs(sharedScriptsForLanguageService);
  }, [sharedScriptsForLanguageService]);

  useEffect(() => {
    const quickFixDisposable = registerTypeScriptQuickFixProvider(
      () => sharedScriptsForLanguageService
    );

    const importIntelligenceDisposables = registerImportIntelligence(
      () => sharedScriptsForLanguageService
    );

    // Shared script source models would make TypeScript auto-import emit a
    // relative path to the in-memory model instead of the canonical
    // `scripts/<moduleName>/main` specifier from the extra lib.
    // Keep the script currently being edited as a physical model so Monaco
    // does not dispose it while the user is typing in the module name field.
    const sharedModelUris = sharedScriptsForLanguageService.flatMap(
      (shared) => [
        buildModelUri(`scripts/${shared.moduleName}/main`, "typescript"),
        buildModelUri(`scripts/${shared.moduleName}/types.d`, "typescript"),
      ]
    );

    setSuppressedModelUris(sharedModelUris);

    return () => {
      quickFixDisposable.dispose();
      importIntelligenceDisposables.forEach((d) => d.dispose());
      setSuppressedModelUris([]);
    };
  }, [sharedScriptsForLanguageService]);

  useEffect(() => {
    const ambientLibs = sharedScriptsForLanguageService
      .filter((shared) => shared.typeDefinitions.trim())
      .map((shared) => ({
        id: `shared:${scriptId}:${shared.id}`,
        filePath: `file:///scripts/${shared.moduleName}/types.ambient.d.ts`,
        contents: stripExportsForAmbientLib(shared.typeDefinitions),
      }))
      .filter((lib) => lib.contents.trim());

    syncAmbientTypeDefinitionLibs(ambientLibs);
  }, [scriptId, sharedScriptsForLanguageService]);

  useEffect(() => {
    return () => {
      syncAmbientTypeDefinitionLibs([]);
    };
  }, []);

  // Sync CDN module type declarations when the module list changes.
  const [cdnTypesReady, setCdnTypesReady] = useState(cdnModules.length === 0);

  useEffect(() => {
    let cancelled = false;

    if (cdnModules.length === 0) {
      setCdnTypesReady(true);
      return;
    }

    setCdnTypesReady(false);

    void syncCdnModuleLibs(cdnModules).then(() => {
      if (!cancelled) {
        setCdnTypesReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cdnModules]);

  if (!cdnTypesReady) {
    return null;
  }

  return <CodeEditor {...rest} scriptId={scriptId} language="typescript" />;
}

/**
 * Strips top-level `export` keywords from type definition content before
 * registering it as an ambient (globally-visible) extra lib.
 *
 * A `.d.ts` file containing any top-level `export` keyword is treated by
 * TypeScript as a module declaration file — all declarations become
 * module-scoped and require an explicit `import` to access. Stripping the
 * keyword keeps declarations globally visible regardless of whether the user
 * has also exported them for use by other scripts.
 *
 * Exports are preserved in the source that flows through the script module
 * extra libs, so `import { X } from "scripts/.../main"` still resolves correctly.
 */
function stripExportsForAmbientLib(typeDefinitions: string): string {
  return (
    typeDefinitions
      // Strip `export` from named declarations: `export type X` → `type X`.
      // The negative lookahead prevents `export type { X }` from being matched
      // here; that form is a re-export and is removed by the next rule.
      .replace(
        /^export\s+(type(?!\s*\{)|interface|const|let|var|function|class|enum|declare|abstract)\b/gm,
        "$1"
      )
      // Remove named re-exports: `export { X }`, `export type { X }`,
      // `export { X } from '...'`, `export type { X } from '...'`.
      .replace(
        /^export\s*(?:type\s+)?\{[^}]*\}(?:\s*from\s*["'][^"']*["'])?\s*;?\s*$/gm,
        ""
      )
      // Remove namespace re-exports: `export * from '...'`, `export * as X from '...'`.
      .replace(
        /^export\s*\*(?:\s*as\s+\w+)?\s*from\s*["'][^"']*["']\s*;?\s*$/gm,
        ""
      )
  );
}
