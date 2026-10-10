import { getScriptModulePath, type Userscript } from "./model";
import { getSharedImportModuleNames } from "./shared-module-imports";
import { normalizeUserscript } from "./userscript-hydrate";

/**
 * Resolve `scripts/<module>/main` imports in source to shared script IDs.
 *
 * Editor IntelliSense can offer `scripts/<id>/main` for any userscript (including
 * unsaved / non-Shared ones). Those imports must not block Ctrl+S: only Shared
 * matches become `sharedScripts`. Duplicate Shared module paths and self-imports
 * still throw.
 */
export function resolveSharedScriptIdsFromSourceOrThrow(
  script: Userscript,
  scriptsMap: Record<string, Userscript>,
  sourceCode: string
): string[] {
  const moduleNames = getSharedImportModuleNames(sourceCode);

  if (moduleNames.length === 0) {
    return [];
  }

  const sharedByModuleName = new Map<string, string>();

  for (const candidate of Object.values(scriptsMap).map(normalizeUserscript)) {
    if (!candidate.shared) {
      continue;
    }

    const modulePath = getScriptModulePath(candidate);
    const existingScriptId = sharedByModuleName.get(modulePath);

    if (existingScriptId && existingScriptId !== candidate.id) {
      throw new Error(
        `Shared module "${modulePath}" is defined by more than one script.`
      );
    }

    sharedByModuleName.set(modulePath, candidate.id);
  }

  const ids: string[] = [];

  for (const modulePath of moduleNames) {
    const sharedScriptId = sharedByModuleName.get(modulePath);

    if (!sharedScriptId) {
      continue;
    }

    if (sharedScriptId === script.id) {
      throw new Error(
        `Script "${script.name}" cannot import itself from "scripts/${modulePath}/main".`
      );
    }

    ids.push(sharedScriptId);
  }

  return ids;
}

export function hasSharedJavascriptConfigChanged(
  nextScript: Userscript,
  previousScript?: Userscript
): boolean {
  if (!previousScript) {
    return true;
  }

  const nextSharedScripts = nextScript.sharedScripts ?? [];
  const previousSharedScripts = previousScript.sharedScripts ?? [];

  if (
    nextScript.shared !== previousScript.shared ||
    nextScript.moduleName !== previousScript.moduleName ||
    nextSharedScripts.length !== previousSharedScripts.length
  ) {
    return true;
  }

  return nextSharedScripts.some(
    (sharedScriptId, index) => sharedScriptId !== previousSharedScripts[index]
  );
}
