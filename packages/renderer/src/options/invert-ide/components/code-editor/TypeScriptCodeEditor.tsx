import { useAppSelector } from "@/shared/store/hooks";
import { selectModules } from "@/shared/store/slices/modules";
import {
  selectGlobalModuleIdsForUserscript,
  selectSharedScriptsForUserscript,
} from "@/shared/store/slices/code-editor";
import { selectUserscriptById } from "@/shared/store/slices/userscripts";
import {
  ensureTypescriptDefaults,
  syncAmbientTypeDefinitionLibs,
  syncCdnModuleLibs,
  syncSharedScriptLibs,
} from "@packages/monaco";
import type { CdnModuleInfo } from "@packages/monaco";
import { buildScriptTypeSlug } from "./model-cache";
import { useEffect, useMemo } from "react";
import { CodeEditor, CodeEditorProps } from "../../shared/CodeEditor";
import { registerTypeScriptQuickFixProvider } from "@/shared/utils/quick-fix-provider";
import { registerImportIntelligence } from "@/shared/utils/import-intelligence";

/**
 * TypeScript-specific wrapper around {@link CodeEditor} that configures Monaco's
 * TypeScript language service defaults, and synchronizes shared script type
 * declarations and CDN module type definitions for intellisense.
 */
export function TypeScriptCodeEditor(
  props: Omit<CodeEditorProps, "language"> & {
    ambientTypeDefinitions?: string;
  }
) {
  const { scriptId, ambientTypeDefinitions = "", ...rest } = props;
  const sharedScripts = useAppSelector(
    useMemo(() => selectSharedScriptsForUserscript(scriptId), [scriptId])
  );
  const scriptName = useAppSelector(
    useMemo(
      () => (state) => selectUserscriptById(state, scriptId)?.name ?? "",
      [scriptId]
    )
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

  // Configure the TypeScript language service defaults once, then sync shared
  // script type declarations whenever the dependency list changes.
  useEffect(() => {
    ensureTypescriptDefaults();

    // Register Quick Fix provider
    const quickFixDisposable = registerTypeScriptQuickFixProvider(
      () => sharedScripts ?? []
    );

    // Register Import Intelligence providers
    const importIntelligenceDisposables = registerImportIntelligence(
      () => sharedScripts ?? []
    );

    if (sharedScripts) {
      syncSharedScriptLibs(sharedScripts);
    }

    return () => {
      quickFixDisposable.dispose();
      importIntelligenceDisposables.forEach((d) => d.dispose());
    };
  }, [sharedScripts]);

  useEffect(() => {
    const ambientLibs = [
      {
        id: `script:${scriptId}:ambient-types`,
        filePath: `file:///node_modules/userscripts/${buildScriptTypeSlug(scriptName, scriptId)}/types.d.ts`,
        contents: ambientTypeDefinitions,
      },
      ...(sharedScripts ?? [])
        .filter((shared) => shared.typeDefinitions.trim())
        .map((shared) => ({
          id: `shared:${scriptId}:${shared.id}`,
          filePath: `file:///node_modules/userscripts/${buildScriptTypeSlug(shared.name, shared.id)}/types.d.ts`,
          contents: shared.typeDefinitions,
        })),
    ].filter((lib) => lib.contents.trim());

    syncAmbientTypeDefinitionLibs(ambientLibs);
  }, [ambientTypeDefinitions, scriptId, scriptName, sharedScripts]);

  useEffect(() => {
    return () => {
      syncAmbientTypeDefinitionLibs([]);
    };
  }, []);

  // Sync CDN module type declarations when the module list changes.
  useEffect(() => {
    syncCdnModuleLibs(cdnModules);
  }, [cdnModules]);

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
 * Exports are preserved in the source that flows through
 * `generateSharedScriptDeclaration`, so `import { X } from "shared/..."` still
 * resolves correctly.
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
