import { createAsyncThunk } from "@reduxjs/toolkit/react";
import {
  buildCompiledCodeEntry,
  hashUserscriptCompileSources,
  isCompiledCodeBuildCurrent,
} from "@shared/compile-metadata";
import {
  findDuplicateModulePathScript,
  getScriptModulePath,
  type Userscript,
} from "@shared/model";
import {
  hasSharedJavascriptConfigChanged,
  resolveSharedScriptIdsFromSourceOrThrow,
} from "@shared/resolve-shared-scripts";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import {
  mergeCompiledCode,
  normalizeUserscript,
  toStorageSafeUserscript,
} from "@shared/userscript-hydrate";
import { commitDraftForSave } from "../editor-drafts/actions";
import { extractUserscriptMetadataUpdates } from "../editor-drafts/helpers";
import type { DraftBuffer } from "../editor-drafts/state.editor-drafts";
import type { RootState } from "../../store";
import {
  compileAllOutputsOrThrow,
  compileJavascriptOrThrow,
  getBuildOptions,
} from "./compile-helpers";
import { sendApplyScriptsMessage } from "./messaging";

export const updateUserscript = createAsyncThunk<
  Userscript,
  { id: string; updates: Partial<Userscript> },
  { state: RootState }
>("userscripts/updateUserscript", async ({ id, updates }, { getState }) => {
  const state = getState();
  const previousScriptsMap = await ChromeSyncStorage.getAllScripts();
  const storedEntry = previousScriptsMap[id];
  const localEntity = state.userscripts.scripts?.[id];

  const entity = storedEntry ?? localEntity;

  if (!entity) {
    throw new Error(`Userscript not found: ${id}`);
  }

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
  const compiledEntry = await CompiledCodeStorage.getCompiledCode(
    normalizedScript.id
  );
  const buildOptions = {
    ...getBuildOptions(state),
    sourceHash: hashUserscriptCompileSources(normalizedScript),
  };

  let pendingCompiled:
    | Awaited<ReturnType<typeof compileAllOutputsOrThrow>>
    | undefined;

  if (!isCompiledCodeBuildCurrent(compiledEntry, buildOptions)) {
    pendingCompiled = await compileAllOutputsOrThrow(normalizedScript, state);
    normalizedScript.code.compiled.javascript = pendingCompiled.javascript;
    normalizedScript.code.compiled.css = pendingCompiled.css;
  } else if (
    hasSharedJavascriptConfigChanged(normalizedScript, previousScript)
  ) {
    const javascript = await compileJavascriptOrThrow(normalizedScript, state);
    const css = compiledEntry?.css ?? normalizedScript.code.compiled.css;
    pendingCompiled = buildCompiledCodeEntry(javascript, css, buildOptions);
    normalizedScript.code.compiled.javascript = javascript;
    normalizedScript.code.compiled.css = css;
  }

  const latestMap = await ChromeSyncStorage.getAllScripts();
  const latestEntry = latestMap[id];
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
    await CompiledCodeStorage.saveCompiledCode(
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
    await ChromeSyncStorage.updateScript(normalizedScript.id, storageSafe);
  } else {
    await ChromeSyncStorage.saveScript(storageSafe);
  }

  const compiledForReturn = sourceChanged
    ? ((await CompiledCodeStorage.getCompiledCode(id)) ?? {
        javascript: "",
        css: "",
      })
    : (pendingCompiled ??
      compiledEntry ?? {
        javascript: normalizedScript.code.compiled.javascript,
        css: normalizedScript.code.compiled.css,
      });

  return {
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
});

export type PersistScriptBuffersArgs = {
  scriptId: string;
  /**
   * Optional buffer overrides merged over the current draft (e.g.
   * Prettier-formatted Ctrl+S content for the focused pane).
   */
  bufferOverrides?: Partial<Record<DraftBuffer, string>>;
  /** Re-inject matching tabs after save. Default true. */
  applyTabs?: boolean;
  /**
   * Compile TS/SCSS before persisting. Default true. Type-definition-only
   * saves set this false so broken TypeScript cannot block a types edit.
   */
  compile?: boolean;
};

/**
 * Canonical write path for open-document draft buffers: resolve shared
 * imports → optional compile → commit drafts clean → sync + local → optional apply.
 */
export const persistScriptBuffers = createAsyncThunk<
  {
    script: Userscript;
    appliedTabCount: number;
    applySuccess: boolean;
    staleSkipCount: number;
  },
  PersistScriptBuffersArgs,
  { state: RootState }
>(
  "userscripts/persistScriptBuffers",
  async (
    { scriptId, bufferOverrides, applyTabs = true, compile = true },
    { getState, dispatch, requestId }
  ) => {
    const state = getState();
    const draft = state.editorDrafts.drafts[scriptId];

    if (!draft) {
      throw new Error(`No editor draft found for script: ${scriptId}`);
    }

    const typescript = bufferOverrides?.typescript ?? draft.typescript;
    const scss = bufferOverrides?.scss ?? draft.scss;
    const typeDefinitions =
      bufferOverrides?.typeDefinitions ?? draft.typeDefinitions;

    const scriptsMap = await ChromeSyncStorage.getAllScripts();
    const storedEntry = scriptsMap[scriptId];
    const entity = storedEntry ?? state.userscripts.scripts?.[scriptId];

    if (!entity) {
      throw new Error(`Userscript not found: ${scriptId}`);
    }

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

    script.code.source.typescript = typescript;
    script.code.source.scss = scss;
    script.typeDefinitions = typeDefinitions;

    try {
      script.sharedScripts = resolveSharedScriptIdsFromSourceOrThrow(
        script,
        { ...scriptsMap, [script.id]: script },
        typescript
      );
    } catch (error) {
      // Types-only saves must not fail on unresolved imports in draft TS.
      if (compile) {
        throw error;
      }
    }

    let compiledEntry = await CompiledCodeStorage.getCompiledCode(scriptId);

    if (compile) {
      compiledEntry = await compileAllOutputsOrThrow(script, getState());
      script.code.compiled.javascript = compiledEntry.javascript;
      script.code.compiled.css = compiledEntry.css;
    } else if (compiledEntry) {
      script.code.compiled.javascript = compiledEntry.javascript;
      script.code.compiled.css = compiledEntry.css;
    }

    script.status = "saved";
    script.updatedAt = Date.now();

    // Commit immediately before the sync write so same-tab onChanged echoes
    // do not race a still-dirty draft.
    const committed: Array<{ buffer: DraftBuffer; code: string }> = [
      { buffer: "typescript", code: typescript },
      { buffer: "scss", code: scss },
      { buffer: "typeDefinitions", code: typeDefinitions },
    ];

    for (const { buffer, code } of committed) {
      dispatch(
        commitDraftForSave({
          scriptId,
          buffer,
          code,
          saveRequestId: requestId,
        })
      );
    }

    const storageSafe = toStorageSafeUserscript(script);

    if (storedEntry) {
      await ChromeSyncStorage.updateScript(scriptId, storageSafe);
    } else {
      await ChromeSyncStorage.saveScript(storageSafe);
    }

    if (compile && compiledEntry) {
      await CompiledCodeStorage.saveCompiledCode(scriptId, compiledEntry);
    }

    const applyResult = applyTabs
      ? await sendApplyScriptsMessage([scriptId])
      : { appliedTabCount: 0, success: true, staleSkipCount: 0 };

    return {
      script: compiledEntry ? mergeCompiledCode(script, compiledEntry) : script,
      appliedTabCount: applyResult.appliedTabCount,
      applySuccess: applyResult.success,
      staleSkipCount: applyResult.staleSkipCount ?? 0,
    };
  }
);
