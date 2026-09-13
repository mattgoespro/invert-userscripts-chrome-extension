import type { Userscript, Userscripts } from "./model";
import { getScriptModulePath } from "./model";
import { getSharedImportModuleNames } from "./shared-module-imports";

function dependsOnAffected(
  script: Userscript,
  affected: Set<string>,
  scriptsMap: Userscripts
): boolean {
  if (script.sharedScripts?.some((sharedId) => affected.has(sharedId))) {
    return true;
  }

  const importedPaths = new Set(
    getSharedImportModuleNames(script.code?.source?.typescript ?? "")
  );

  if (importedPaths.size === 0) {
    return false;
  }

  for (const candidate of Object.values(scriptsMap)) {
    if (!affected.has(candidate.id) || !candidate.shared) {
      continue;
    }

    if (importedPaths.has(getScriptModulePath(candidate))) {
      return true;
    }
  }

  return false;
}

/**
 * Expand a set of script IDs to include consumers that import any of them
 * as shared dependencies (fixpoint / BFS). Used so saving/rebuilding a shared
 * module also re-applies scripts that depend on it, including nested consumers.
 *
 * Edges come from TypeScript source imports and the persisted `sharedScripts`
 * cache so apply still works if one of those views is briefly stale.
 */
export function expandAffectedScriptIds(
  scriptIds: string[],
  scriptsMap: Userscripts
): string[] {
  const affected = new Set(
    scriptIds.filter((scriptId) => scriptsMap[scriptId] != null)
  );

  let grew = true;

  while (grew) {
    grew = false;

    for (const script of Object.values(scriptsMap)) {
      if (affected.has(script.id)) {
        continue;
      }

      if (dependsOnAffected(script, affected, scriptsMap)) {
        affected.add(script.id);
        grew = true;
      }
    }
  }

  return Array.from(affected);
}
