import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import type { StorageReconciliationContext } from "../../../services/storage-reconciliation";
import type { Dispatch } from "@reduxjs/toolkit";
import type { Userscripts } from "@shared/model";
import type { EditorDraft } from "./state.editor-drafts";

export interface StorageSyncState {
  userscripts: { scripts?: Userscripts };
  editorDrafts: { drafts: Record<string, EditorDraft> };
}
import {
  enqueueConflict,
  removeDraft,
  syncDraftFromRemoteScript,
} from "./actions";
import {
  removeRemoteScripts,
  syncScriptsFromRemote,
} from "../userscripts/actions.publication";

/** Load and storage events use the same atomic reconciliation adapter. */
export function storageSyncContext(
  getState: () => StorageSyncState,
  dispatch: Dispatch
): StorageReconciliationContext {
  return {
    sourceStorage: ChromeSyncStorage,
    compiledStorage: CompiledCodeStorage,
    getScriptIds: () => Object.keys(getState().userscripts.scripts ?? {}),
    getDrafts: () => getState().editorDrafts.drafts,
    removeDraft: (id) => {
      dispatch(removeDraft(id));
    },
    enqueueConflict: (conflict) => {
      dispatch(enqueueConflict(conflict));
    },
    syncDraft: (script) => {
      dispatch(syncDraftFromRemoteScript(script));
    },
    removeScripts: (ids) => {
      dispatch(removeRemoteScripts(ids));
    },
    syncScripts: (scripts) => {
      dispatch(syncScriptsFromRemote(scripts));
    },
  };
}
