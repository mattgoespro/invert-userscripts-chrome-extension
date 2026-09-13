import { createAsyncThunk } from "@reduxjs/toolkit/react";
import { Userscript } from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import { hydrateUserscriptWithCompiled } from "@shared/userscript-hydrate";
import type { RootState } from "../../store";
import { decideStorageSyncAction } from "./storage-sync-decision";
import {
  enqueueConflict,
  removeDraft,
  syncDraftFromRemoteScript,
} from "./index";
import { removeRemoteScripts } from "../userscripts";

export const refreshScriptsFromStorage = createAsyncThunk<
  { syncedScripts: Userscript[]; conflictIds: string[] },
  { scriptIds?: string[] } | undefined,
  { state: RootState }
>(
  "editorDrafts/refreshScriptsFromStorage",
  async (args, { getState, dispatch }) => {
    const [scriptsMap, compiledCodeMap] = await Promise.all([
      ChromeSyncStorage.getAllScripts(),
      CompiledCodeStorage.getAllCompiledCode(),
    ]);

    // Re-read after awaits so an in-flight local save can clear dirty flags
    // before we decide whether a storage echo is a real conflict.
    const state = getState();
    const targetIds = args?.scriptIds ?? [
      ...new Set([
        ...Object.keys(state.editorDrafts.drafts),
        ...Object.keys(scriptsMap),
      ]),
    ];

    const syncedScripts: Userscript[] = [];
    const conflictIds: string[] = [];
    const removedIds: string[] = [];

    for (const scriptId of targetIds) {
      const remoteScript = scriptsMap[scriptId];
      const localDraft = getState().editorDrafts.drafts[scriptId];
      const hydrated = remoteScript
        ? hydrateUserscriptWithCompiled(remoteScript, compiledCodeMap[scriptId])
        : undefined;

      const decision = decideStorageSyncAction(scriptId, localDraft, hydrated);

      switch (decision.action) {
        case "keep-dirty-orphan":
          break;
        case "remove":
          dispatch(removeDraft(scriptId));
          // A hydrate miss looks like "not in scriptsMap" even when the
          // manifest key is still present (mid-write or decode failure).
          // Only drop the Redux entity when storage actually deleted it.
          if (!(await ChromeSyncStorage.hasScriptManifest(scriptId))) {
            removedIds.push(scriptId);
          }
          break;
        case "conflict":
          dispatch(enqueueConflict(decision.conflict));
          conflictIds.push(scriptId);
          break;
        case "sync-entity":
          // Update the userscripts entity only — leave the dirty draft alone.
          syncedScripts.push(decision.script);
          break;
        case "sync":
          dispatch(syncDraftFromRemoteScript(decision.script));
          syncedScripts.push(decision.script);
          break;
      }
    }

    if (removedIds.length > 0) {
      dispatch(removeRemoteScripts(removedIds));
    }

    return { syncedScripts, conflictIds };
  }
);
