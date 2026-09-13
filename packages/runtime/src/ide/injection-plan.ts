import {
  CompiledCodeEntry,
  getScriptModulePath,
  GlobalModules,
  Userscript,
  Userscripts,
} from "@shared/model";
import { isCompiledArtifactFresh } from "@shared/compile-metadata";
import { matchesUrlPattern } from "@shared/url-matching";
import { getSharedImportModuleNames } from "@shared/shared-module-imports";
import { resolveWorkspaceScriptClosure } from "@shared/workspace-closure";

/**
 * Selects enabled userscripts that match the tab URL and requested run timing.
 * Matching happens before compiled-code merge so disabled/unmatched scripts are
 * not hydrated from local storage.
 */
export function selectMatchingScriptsForInjection(
  scriptsMap: Userscripts,
  url: string,
  timing: Userscript["runAt"]
): Userscript[] {
  return Object.values(scriptsMap).filter(
    (script) =>
      script.enabled &&
      !script.shared &&
      script.runAt === timing &&
      matchesUrlPattern(url, script.urlPatterns)
  );
}

/**
 * Shared-module IDs needed on the page for these userscripts, in dependency
 * order (nested imports before their consumers). Edges come from TypeScript
 * source, not the persisted sharedScripts cache.
 */
export function collectSharedScriptIdsToInject(
  matchingScripts: Userscript[],
  scriptsMap: Userscripts
): string[] {
  const injectedShared = new Set<string>();
  const ordered: string[] = [];

  for (const script of matchingScripts) {
    const closure = resolveWorkspaceScriptClosure(script, scriptsMap, {
      getTypescriptSource: (candidate) => candidate.code.source.typescript,
    });

    for (const scriptId of closure) {
      if (scriptId === script.id || injectedShared.has(scriptId)) {
        continue;
      }

      if (scriptsMap[scriptId]?.shared) {
        ordered.push(scriptId);
        injectedShared.add(scriptId);
      }
    }
  }

  return ordered;
}

/**
 * Collects script IDs whose compiled payloads must be loaded for injection,
 * including the transitive shared-module closure of matching userscripts.
 */
export function collectCompiledCodeScriptIds(
  matchingScripts: Userscript[],
  scriptsMap: Userscripts
): string[] {
  const scriptIdsToFetch = new Set<string>(
    matchingScripts.map((script) => script.id)
  );

  for (const sharedId of collectSharedScriptIdsToInject(
    matchingScripts,
    scriptsMap
  )) {
    scriptIdsToFetch.add(sharedId);
  }

  return Array.from(scriptIdsToFetch);
}

/**
 * True when a userscript (or a nested shared import) refers to a
 * `scripts/<module>/main` path that is not a shared module in `scriptsMap`.
 */
export function hasUnresolvedSharedImports(
  script: Userscript,
  scriptsMap: Userscripts
): boolean {
  const sharedByModulePath = new Map<string, string>();

  for (const candidate of Object.values(scriptsMap)) {
    if (candidate.shared) {
      sharedByModulePath.set(getScriptModulePath(candidate), candidate.id);
    }
  }

  const seen = new Set<string>();

  const visit = (scriptId: string): boolean => {
    if (seen.has(scriptId)) {
      return false;
    }

    seen.add(scriptId);

    const current = scriptsMap[scriptId];

    if (!current) {
      return true;
    }

    for (const modulePath of getSharedImportModuleNames(
      current.code.source.typescript
    )) {
      const dependencyId = sharedByModulePath.get(modulePath);

      if (!dependencyId || visit(dependencyId)) {
        return true;
      }
    }

    return false;
  };

  return visit(script.id);
}

export function sharedDependenciesAreFresh(
  script: Userscript,
  scriptsMap: Userscripts,
  compiledCodeMap: Record<string, CompiledCodeEntry | undefined>,
  minifyCompiledOutput?: boolean
): boolean {
  if (hasUnresolvedSharedImports(script, scriptsMap)) {
    return false;
  }

  for (const sharedId of collectSharedScriptIdsToInject([script], scriptsMap)) {
    const shared = scriptsMap[sharedId];
    const entry = compiledCodeMap[sharedId];

    if (
      !shared?.shared ||
      !isCompiledArtifactFresh(shared, entry, minifyCompiledOutput) ||
      !entry?.javascript?.trim()
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Overlays locally cached compiled JS/CSS onto a userscript manifest entry.
 * Missing compiled entries leave the script unchanged.
 */
export function mergeCompiledCode(
  script: Userscript,
  compiledCodeMap: Record<string, CompiledCodeEntry>
): Userscript {
  const compiled = compiledCodeMap[script.id];

  if (!compiled) {
    return script;
  }

  return {
    ...script,
    code: {
      ...script.code,
      compiled: {
        javascript: compiled.javascript || script.code.compiled.javascript,
        css: compiled.css || script.code.compiled.css,
      },
    },
  };
}

/**
 * Returns enabled CDN module IDs in first-seen injection order across the
 * matching userscripts. Disabled or missing modules are skipped.
 */
export function collectEnabledCdnModuleIds(
  scripts: Userscript[],
  modulesMap: GlobalModules
): string[] {
  const injectedModules = new Set<string>();
  const ordered: string[] = [];

  for (const script of scripts) {
    if (!script.globalModules?.length) {
      continue;
    }

    for (const moduleId of script.globalModules) {
      if (injectedModules.has(moduleId)) {
        continue;
      }

      const module = modulesMap[moduleId];

      if (module?.enabled) {
        ordered.push(moduleId);
        injectedModules.add(moduleId);
      }
    }
  }

  return ordered;
}
