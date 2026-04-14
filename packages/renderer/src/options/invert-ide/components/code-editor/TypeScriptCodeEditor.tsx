import { useAppSelector } from "@/shared/store/hooks";
import {
  selectGlobalModuleIdsForUserscript,
  selectSharedScriptsForUserscript,
} from "@/shared/store/slices/monaco-editor";
import {
  ensureTypescriptDefaults,
  syncCdnModuleLibs,
  syncSharedScriptLibs,
} from "@packages/monaco";
import type { CdnModuleInfo } from "@packages/monaco";
import { ChromeSyncStorage } from "@shared/storage";
import { useEffect, useMemo, useState } from "react";
import { CodeEditor, CodeEditorProps } from "../../shared/CodeEditor";

/**
 * TypeScript-specific wrapper around {@link CodeEditor} that configures Monaco's
 * TypeScript language service defaults, and synchronizes shared script type
 * declarations and CDN module type definitions for intellisense.
 */
export function TypeScriptCodeEditor(props: Omit<CodeEditorProps, "language">) {
  const { scriptId, ...rest } = props;
  const sharedScripts = useAppSelector(
    useMemo(() => selectSharedScriptsForUserscript(scriptId), [scriptId])
  );
  const globalModuleIds = useAppSelector(
    useMemo(() => selectGlobalModuleIdsForUserscript(scriptId), [scriptId])
  );
  const [cdnModules, setCdnModules] = useState<CdnModuleInfo[]>([]);

  // Resolve global module IDs to CdnModuleInfo by loading from storage
  useEffect(() => {
    if (!globalModuleIds?.length) {
      setCdnModules([]);
      return;
    }

    ChromeSyncStorage.getAllModules().then((modulesMap) => {
      const resolved: CdnModuleInfo[] = globalModuleIds
        .map((id) => modulesMap[id])
        .filter((m) => m?.packageName)
        .map((m) => ({ id: m.id, packageName: m.packageName! }));
      setCdnModules(resolved);
    });
  }, [globalModuleIds]);

  // Configure the TypeScript language service defaults once, then sync shared
  // script type declarations whenever the dependency list changes.
  useEffect(() => {
    ensureTypescriptDefaults();

    if (sharedScripts) {
      syncSharedScriptLibs(sharedScripts);
    }
  }, [sharedScripts]);

  // Sync CDN module type declarations when the module list changes.
  useEffect(() => {
    syncCdnModuleLibs(cdnModules);
  }, [cdnModules]);

  return <CodeEditor {...rest} scriptId={scriptId} language="typescript" />;
}
