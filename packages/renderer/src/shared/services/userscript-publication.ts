import type { ApplyScriptsResponse } from "@shared/messages";
import {
  buildCompiledCodeEntry,
  hashUserscriptCompileSources,
  isCompiledCodeBuildCurrent,
  isUserscriptCompileSnapshotStale,
  type CompiledOutputBuildOptions,
} from "@shared/compile-metadata";
import {
  findDuplicateModulePathScript,
  getScriptModulePath,
  type CompiledCodeEntry,
  type Userscript,
  type Userscripts,
} from "@shared/model";
import {
  hasSharedJavascriptConfigChanged,
  resolveSharedScriptIdsFromSourceOrThrow,
} from "@shared/resolve-shared-scripts";
import type { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import {
  mergeCompiledCode,
  normalizeUserscript,
  toStorageSafeUserscript,
} from "@shared/userscript-hydrate";
import type {
  DraftSaveContext,
  DraftSaveResult,
  PersistScriptBuffersArgs,
} from "./draft-save-lifecycle";
import type { DraftBuffer } from "../store/slices/editor-drafts/state.editor-drafts";
import { extractUserscriptMetadataUpdates } from "../store/slices/editor-drafts/helpers";

interface PublicationStorage {
  sourceStorage: Pick<
    typeof ChromeSyncStorage,
    "getAllScripts" | "saveScript" | "updateScript"
  >;
  compiledStorage: Pick<
    typeof CompiledCodeStorage,
    "getCompiledCode" | "saveCompiledCode"
  >;
}

export interface PublicationContext extends PublicationStorage {
  getLocalScripts(): Userscripts;
  getBuildOptions(): CompiledOutputBuildOptions;
  compileAll(script: Userscript): Promise<CompiledCodeEntry>;
  compileJavascript(script: Userscript): Promise<string>;
}

const BUFFERS: DraftBuffer[] = ["typescript", "scss", "typeDefinitions"];
// One owner for all participating writers in this IDE window. Acquire before
// reads, and release after the complete operation, even on partial failure.
const publications = new Map<string, Promise<void>>();
const deletedSourceIds = new Set<string>();
const versions = new Map<string, number>();
let revision = 0;
let fullObservation = 0;

function invalidate(scriptId: string): void {
  versions.set(scriptId, (versions.get(scriptId) ?? 0) + 1);
  revision += 1;
}

/** Reads never hold publication ownership. Retry, then accept without yielding. */
export async function observePublishedScripts<T, R>(
  scriptIds: string[] | undefined,
  read: () => Promise<T>,
  accept: (snapshot: T) => R
): Promise<R> {
  for (;;) {
    const pending = [...publications].filter(
      ([id]) => scriptIds === undefined || scriptIds.includes(id)
    );
    await Promise.all(pending.map(([, task]) => task));
    const observedRevision = revision;
    const observedFull = fullObservation;
    const observedVersions = scriptIds?.map((id) => versions.get(id) ?? 0);
    const snapshot = await read();
    const changed =
      scriptIds === undefined
        ? revision !== observedRevision
        : fullObservation !== observedFull ||
          scriptIds.some(
            (id, index) => (versions.get(id) ?? 0) !== observedVersions[index]
          );
    const publishing = [...publications.keys()].some(
      (id) => scriptIds === undefined || scriptIds.includes(id)
    );
    if (changed || publishing) {
      continue;
    }
    // Accepted observations also supersede overlapping load/refresh reads.
    if (scriptIds === undefined) {
      fullObservation += 1;
      revision += 1;
    } else {
      scriptIds.forEach(invalidate);
    }
    return accept(snapshot);
  }
}

function editableEntry(
  id: string,
  stored: Userscript | undefined,
  local: Userscript | undefined
): Userscript {
  if (stored) {
    deletedSourceIds.delete(id);
    return stored;
  }
  if (!local || deletedSourceIds.has(id)) {
    throw new Error(`Userscript not found: ${id}`);
  }
  return local;
}

function publishInOrder<T>(
  scriptId: string,
  operation: () => Promise<T>
): Promise<T> {
  invalidate(scriptId);
  const previous = publications.get(scriptId) ?? Promise.resolve();
  const result = previous.then(operation);
  const settled = result.then(
    () => {},
    () => {}
  );
  publications.set(scriptId, settled);
  void settled.then(() => {
    invalidate(scriptId);
    if (publications.get(scriptId) === settled) {
      publications.delete(scriptId);
    }
  });
  return result;
}

export function publishDraft(
  args: PersistScriptBuffersArgs,
  context: DraftSaveContext,
  snapshot: Record<DraftBuffer, string>,
  buffers: Record<DraftBuffer, string>,
  localScripts: Userscripts
): Promise<DraftSaveResult> {
  return publishInOrder(args.scriptId, async () => {
    const focused = args.focusedBuffer;
    if (focused?.autoFormat) {
      buffers[focused.buffer] = await context.format(
        focused.code,
        focused.buffer === "scss" ? "scss" : "typescript"
      );
    }
    return saveDraftSnapshot(args, context, snapshot, buffers, localScripts);
  });
}

async function saveDraftSnapshot(
  {
    scriptId,
    applyTabs = true,
    compile = true,
    conflictId = null,
  }: PersistScriptBuffersArgs,
  context: DraftSaveContext,
  snapshot: Record<DraftBuffer, string>,
  buffers: Record<DraftBuffer, string>,
  localScripts: Userscripts
): Promise<DraftSaveResult> {
  const scriptsMap = await context.sourceStorage.getAllScripts();
  const storedEntry = scriptsMap[scriptId];
  const entity = editableEntry(scriptId, storedEntry, localScripts[scriptId]);
  const script: Userscript = {
    ...normalizeUserscript(entity),
    sharedScripts: [...(entity.sharedScripts ?? [])],
    globalModules: [...(entity.globalModules ?? [])],
    urlPatterns: [...(entity.urlPatterns ?? [])],
    code: {
      source: { ...entity.code.source },
      compiled: { ...entity.code.compiled },
    },
  };
  const duplicate = findDuplicateModulePathScript(
    Object.values(scriptsMap).map(normalizeUserscript),
    script
  );
  if (duplicate) {
    throw new Error(
      `Module path "${getScriptModulePath(script)}" is already used by "${duplicate.name}". Choose a unique module name.`
    );
  }
  script.code.source.typescript = buffers.typescript;
  script.code.source.scss = buffers.scss;
  script.typeDefinitions = buffers.typeDefinitions;
  try {
    script.sharedScripts = resolveSharedScriptIdsFromSourceOrThrow(
      script,
      { ...localScripts, ...scriptsMap, [script.id]: script },
      buffers.typescript
    );
  } catch (error) {
    if (compile) {
      throw error;
    }
  }

  let compiledEntry = await context.compiledStorage.getCompiledCode(scriptId);
  if (compile) {
    compiledEntry = await context.compile(script);
  }
  if (compiledEntry) {
    script.code.compiled.javascript = compiledEntry.javascript;
    script.code.compiled.css = compiledEntry.css;
  }
  script.status = "saved";
  script.updatedAt = Date.now();

  if (storedEntry && !(await context.sourceStorage.getAllScripts())[scriptId]) {
    throw new Error(`Userscript not found: ${scriptId}`);
  }
  // Publish saved baselines immediately before sync storage can echo them.
  for (const buffer of BUFFERS) {
    context.commit({
      scriptId,
      buffer,
      code: buffers[buffer],
      snapshotCode: snapshot[buffer],
      saveRequestId: context.requestId,
    });
  }
  const storageSafe = toStorageSafeUserscript(script);
  if (storedEntry) {
    await context.sourceStorage.updateScript(scriptId, storageSafe);
  } else {
    await context.sourceStorage.saveScript(storageSafe);
  }
  if (compile && compiledEntry) {
    await context.compiledStorage.saveCompiledCode(scriptId, compiledEntry);
  }
  const published = compiledEntry
    ? mergeCompiledCode(script, compiledEntry)
    : script;
  context.acceptPublished?.(published);
  const applyResult = applyTabs
    ? await context.apply([scriptId])
    : { appliedTabCount: 0, success: true, staleSkipCount: 0 };
  return {
    script: published,
    conflictId,
    appliedTabCount: applyResult.appliedTabCount,
    applySuccess: applyResult.success,
    staleSkipCount: applyResult.staleSkipCount ?? 0,
  };
}

export function publishMetadata(
  id: string,
  updates: Partial<Userscript>,
  context: PublicationContext,
  acceptPublished: (script: Userscript) => void = () => {}
): Promise<Userscript> {
  return publishInOrder(id, async () => {
    const previousScriptsMap = await context.sourceStorage.getAllScripts();
    const storedEntry = previousScriptsMap[id];
    const localEntity = context.getLocalScripts()[id];

    const entity = editableEntry(id, storedEntry, localEntity);

    const storedScript = {
      ...normalizeUserscript(entity),
      sharedScripts: [...(entity.sharedScripts ?? [])],
      globalModules: [...(entity.globalModules ?? [])],
      urlPatterns: [...(entity.urlPatterns ?? [])],
      code: {
        source: { ...entity.code.source },
        compiled: { ...entity.code.compiled },
      },
    };

    const metadataUpdates = extractUserscriptMetadataUpdates(updates);
    const normalizedScript = {
      ...storedScript,
      ...metadataUpdates,
      updatedAt: Date.now(),
    };

    const duplicate = findDuplicateModulePathScript(
      Object.values(previousScriptsMap).map(normalizeUserscript),
      normalizedScript
    );

    if (duplicate) {
      throw new Error(
        `Module path "${getScriptModulePath(normalizedScript)}" is already used by "${duplicate.name}". Choose a unique module name.`
      );
    }

    const previousScript = previousScriptsMap[normalizedScript.id]
      ? normalizeUserscript(previousScriptsMap[normalizedScript.id])
      : undefined;
    const compiledEntry = await context.compiledStorage.getCompiledCode(
      normalizedScript.id
    );
    const buildOptions = {
      ...context.getBuildOptions(),
      sourceHash: hashUserscriptCompileSources(normalizedScript),
    };

    let pendingCompiled: CompiledCodeEntry | undefined;

    if (!isCompiledCodeBuildCurrent(compiledEntry, buildOptions)) {
      pendingCompiled = await context.compileAll(normalizedScript);
      normalizedScript.code.compiled.javascript = pendingCompiled.javascript;
      normalizedScript.code.compiled.css = pendingCompiled.css;
    } else if (
      hasSharedJavascriptConfigChanged(normalizedScript, previousScript)
    ) {
      const javascript = await context.compileJavascript(normalizedScript);
      const css = compiledEntry?.css ?? normalizedScript.code.compiled.css;
      pendingCompiled = buildCompiledCodeEntry(javascript, css, buildOptions);
      normalizedScript.code.compiled.javascript = javascript;
      normalizedScript.code.compiled.css = css;
    }

    const latestMap = await context.sourceStorage.getAllScripts();
    const latestEntry = latestMap[id];
    if (storedEntry && !latestEntry) {
      throw new Error(`Userscript not found: ${id}`);
    }
    const latestStored = latestEntry
      ? normalizeUserscript(latestEntry)
      : storedScript;
    const sourceChanged = Boolean(
      latestEntry &&
      (latestStored.code.source.typescript !==
        storedScript.code.source.typescript ||
        latestStored.code.source.scss !== storedScript.code.source.scss ||
        (latestStored.typeDefinitions ?? "") !==
          (storedScript.typeDefinitions ?? ""))
    );

    const persistCandidate = {
      ...latestStored,
      ...metadataUpdates,
      updatedAt: Date.now(),
    };
    const lateDuplicate = findDuplicateModulePathScript(
      Object.values(latestMap).map(normalizeUserscript),
      persistCandidate
    );

    if (lateDuplicate) {
      throw new Error(
        `Module path "${getScriptModulePath(persistCandidate)}" is already used by "${lateDuplicate.name}". Choose a unique module name.`
      );
    }

    if (!sourceChanged && pendingCompiled) {
      await context.compiledStorage.saveCompiledCode(
        normalizedScript.id,
        pendingCompiled
      );
    }

    const storageSafe = toStorageSafeUserscript({
      ...persistCandidate,
      code: {
        source: latestStored.code.source,
        compiled: {
          javascript: "",
          css: "",
        },
      },
      typeDefinitions: latestStored.typeDefinitions,
    });

    if (latestEntry) {
      await context.sourceStorage.updateScript(
        normalizedScript.id,
        storageSafe
      );
    } else {
      await context.sourceStorage.saveScript(storageSafe);
    }

    const compiledForReturn = sourceChanged
      ? ((await context.compiledStorage.getCompiledCode(id)) ?? {
          javascript: "",
          css: "",
        })
      : (pendingCompiled ??
        compiledEntry ?? {
          javascript: normalizedScript.code.compiled.javascript,
          css: normalizedScript.code.compiled.css,
        });

    const published: Userscript = {
      ...persistCandidate,
      code: {
        source: latestStored.code.source,
        compiled: {
          javascript: compiledForReturn.javascript,
          css: compiledForReturn.css,
        },
      },
      typeDefinitions: latestStored.typeDefinitions,
    };
    acceptPublished(published);
    return published;
  });
}

export function rebuildArtifact(
  id: string,
  scope: "stale" | "all",
  context: PublicationContext,
  acceptPublished: (script: Userscript) => void = () => {}
): Promise<Userscript | undefined> {
  return publishInOrder(id, async () => {
    const scriptsMap = await context.sourceStorage.getAllScripts();
    if (!scriptsMap[id]) {
      return undefined;
    }
    const script = normalizeUserscript(scriptsMap[id]);
    const compiled = await context.compiledStorage.getCompiledCode(id);
    if (
      scope === "stale" &&
      isCompiledCodeBuildCurrent(compiled, {
        ...context.getBuildOptions(),
        sourceHash: hashUserscriptCompileSources(script),
      })
    ) {
      return undefined;
    }
    const previousSharedScripts = script.sharedScripts ?? [];
    try {
      script.sharedScripts = resolveSharedScriptIdsFromSourceOrThrow(
        script,
        scriptsMap,
        script.code.source.typescript
      );
    } catch (error) {
      console.warn(
        `Failed to re-resolve sharedScripts for "${script.name}" during rebuild:`,
        error
      );
    }
    let compiledEntry: CompiledCodeEntry;
    try {
      compiledEntry = await context.compileAll(script);
    } catch (error) {
      console.error(
        `Failed to rebuild compiled output for "${script.name}":`,
        error
      );
      return undefined;
    }
    const latestEntry = (await context.sourceStorage.getAllScripts())[id];
    const latest = latestEntry ? normalizeUserscript(latestEntry) : undefined;
    if (isUserscriptCompileSnapshotStale(script, latest)) {
      return undefined;
    }
    await context.compiledStorage.saveCompiledCode(id, compiledEntry);
    const nextSharedScripts = script.sharedScripts ?? [];
    if (
      previousSharedScripts.length !== nextSharedScripts.length ||
      previousSharedScripts.some(
        (value, index) => value !== nextSharedScripts[index]
      )
    ) {
      await context.sourceStorage.updateScript(id, {
        sharedScripts: nextSharedScripts,
      });
    }
    const published = mergeCompiledCode(
      { ...latest, sharedScripts: nextSharedScripts },
      compiledEntry
    );
    // Accept while this publication still owns the script. Batch tab
    // application can finish after a deletion or a later rebuild.
    acceptPublished(published);
    return published;
  });
}

/** Import has already compiled the entire batch before any source is published. */
export function publishImportedScript(
  script: Userscript,
  compiled: CompiledCodeEntry,
  context: PublicationStorage,
  acceptPublished: (script: Userscript) => void = () => {}
): Promise<void> {
  return publishInOrder(script.id, async () => {
    const writes = [
      context.sourceStorage.saveScript(toStorageSafeUserscript(script)),
      context.compiledStorage.saveCompiledCode(script.id, compiled),
    ];
    // A rejected write must not release ownership while its sibling can still
    // publish. Keep the import's rejection policy after both writes settle.
    try {
      await Promise.all(writes);
    } catch (error) {
      await Promise.allSettled(writes);
      throw error;
    }
    deletedSourceIds.delete(script.id);
    acceptPublished(script);
  });
}

/** New scripts retain source-first, best-effort empty artifact seeding. */
export function publishNewScript(
  script: Userscript,
  context: PublicationStorage,
  getBuildOptions: () => Promise<CompiledOutputBuildOptions>,
  acceptPublished: (script: Userscript) => void = () => {}
): Promise<void> {
  return publishInOrder(script.id, async () => {
    await context.sourceStorage.saveScript(script);
    try {
      const options = await getBuildOptions();
      await context.compiledStorage.saveCompiledCode(
        script.id,
        buildCompiledCodeEntry("", "", {
          ...options,
          sourceHash: hashUserscriptCompileSources(script),
        })
      );
    } catch (error) {
      console.warn("Failed to seed compiled code for new userscript:", error);
    }
    deletedSourceIds.delete(script.id);
    acceptPublished(script);
  });
}

export function publishEnabledToggle(
  id: string,
  sourceStorage: PublicationStorage["sourceStorage"],
  acceptPublished: (script: Userscript) => void = () => {},
  apply: (
    id: string,
    enabled: boolean
  ) => Promise<ApplyScriptsResponse> = async () => ({
    success: true,
    appliedTabCount: 0,
  })
): Promise<{ script: Userscript; applyResult: ApplyScriptsResponse }> {
  return publishInOrder(id, async () => {
    const entry = (await sourceStorage.getAllScripts())[id];
    if (!entry) {
      throw new Error(`Userscript not found: ${id}`);
    }
    const script = normalizeUserscript(entry);
    const updatedScript = { ...script, enabled: !script.enabled };
    await sourceStorage.saveScript(toStorageSafeUserscript(updatedScript));
    acceptPublished(updatedScript);
    // A delayed disable must finish removing CSS before a later enable applies.
    const applyResult = await apply(id, updatedScript.enabled);
    return { script: updatedScript, applyResult };
  });
}

export function removePublishedScript(
  id: string,
  sourceStorage: Pick<typeof ChromeSyncStorage, "deleteScript">,
  compiledStorage: Pick<typeof CompiledCodeStorage, "deleteCompiledCode">,
  acceptDeleted: (id: string) => void = () => {}
): Promise<void> {
  return publishInOrder(id, async () => {
    await sourceStorage.deleteScript(id);
    deletedSourceIds.add(id);
    await compiledStorage.deleteCompiledCode(id);
    acceptDeleted(id);
  });
}
