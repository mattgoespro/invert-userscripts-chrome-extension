import { useAppSelector } from "@/shared/store/hooks";
import { selectModules } from "@/shared/store/slices/modules";
import {
  selectGlobalModuleIdsForUserscript,
  selectSharedScriptsForUserscript,
} from "@/shared/store/slices/code-editor";
import {
  ensureTypescriptDefaults,
  syncAmbientTypeDefinitionLibs,
  syncCdnModuleLibs,
  syncSharedScriptLibs,
} from "@packages/monaco";
import type { CdnModuleInfo } from "@packages/monaco";
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
        filePath: `file:///scripts/${scriptId}/types.d.ts`,
        contents: ambientTypeDefinitions,
      },
      ...(sharedScripts ?? [])
        .filter((shared) => shared.typeDefinitions.trim())
        .map((shared) => ({
          id: `shared:${scriptId}:${shared.id}`,
          filePath: `file:///userscripts/${scriptId}/shared/${shared.id}.d.ts`,
          contents: shared.typeDefinitions,
        })),
    ].filter((lib) => lib.contents.trim());

    syncAmbientTypeDefinitionLibs(ambientLibs);
  }, [ambientTypeDefinitions, scriptId, sharedScripts]);

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
