import { createAsyncThunk } from "@reduxjs/toolkit/react";
import { Userscript } from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import type { RootState } from "../../store";
import { detectDraftConflict } from "./helpers";
import { isDraftDirty } from "./state.editor-drafts";
import {
  enqueueConflict,
  removeDraft,
  syncDraftFromRemoteScript,
} from "./index";

function normalizeUserscript(script: Userscript): Userscript {
  return {
    ...script,
    typeDefinitions: script.typeDefinitions ?? "",
  };
}

function mergeCompiledCode(
  script: Userscript,
  compiled?: { javascript: string; css: string } | null
): Userscript {
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

function parseUserscriptIdFromKey(key: string): string | null {
  const prefix = "userscript:";

  if (!key.startsWith(prefix)) {
    return null;
  }

  const remainder = key.slice(prefix.length);
  const chunkIndex = remainder.indexOf(":chunk:");

  if (chunkIndex === -1) {
    return remainder;
  }

  return remainder.slice(0, chunkIndex);
}

export const refreshScriptsFromStorage = createAsyncThunk<
  { syncedScripts: Userscript[]; conflictIds: string[] },
  { scriptIds?: string[] } | undefined,
  { state: RootState }
>(
  "editorDrafts/refreshScriptsFromStorage",
  async (args, { getState, dispatch }) => {
    const state = getState();
    const [scriptsMap, compiledCodeMap] = await Promise.all([
      ChromeSyncStorage.getAllScripts(),
      CompiledCodeStorage.getAllCompiledCode(),
    ]);

    const targetIds = args?.scriptIds ?? [
      ...new Set([
        ...Object.keys(state.editorDrafts.drafts),
        ...Object.keys(scriptsMap),
      ]),
    ];

    const syncedScripts: Userscript[] = [];
    const conflictIds: string[] = [];

    for (const scriptId of targetIds) {
      const remoteScript = scriptsMap[scriptId];
      const localDraft = state.editorDrafts.drafts[scriptId];

      if (!remoteScript) {
        if (localDraft && isDraftDirty(localDraft)) {
          continue;
        }

        dispatch(removeDraft(scriptId));
        continue;
      }

      const hydrated = mergeCompiledCode(
        normalizeUserscript(remoteScript),
        compiledCodeMap[scriptId]
      );

      if (!localDraft) {
        dispatch(syncDraftFromRemoteScript(hydrated));
        syncedScripts.push(hydrated);
        continue;
      }

      const conflict = detectDraftConflict(scriptId, localDraft, hydrated);

      if (conflict) {
        dispatch(enqueueConflict(conflict));
        conflictIds.push(scriptId);
        continue;
      }

      dispatch(syncDraftFromRemoteScript(hydrated));
      syncedScripts.push(hydrated);
    }

    return { syncedScripts, conflictIds };
  }
);

export function getAffectedScriptIdsFromStorageChanges(
  changes: Record<string, chrome.storage.StorageChange>
): string[] {
  const scriptIds = new Set<string>();

  for (const [key, change] of Object.entries(changes)) {
    if (key === "userscripts") {
      const next = change.newValue as Record<string, unknown> | undefined;
      const previous = change.oldValue as Record<string, unknown> | undefined;

      for (const id of Object.keys(next ?? {})) {
        scriptIds.add(id);
      }

      for (const id of Object.keys(previous ?? {})) {
        scriptIds.add(id);
      }

      continue;
    }

    const scriptId = parseUserscriptIdFromKey(key);

    if (scriptId) {
      scriptIds.add(scriptId);
    }
  }

  return [...scriptIds];
}
