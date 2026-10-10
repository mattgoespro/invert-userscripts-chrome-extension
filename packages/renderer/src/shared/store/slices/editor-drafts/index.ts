import {
  acceptPublishedScript,
  acceptDeletedScript,
} from "../userscripts/actions.publication";
import {
  completeDraftSave,
  rejectDraftSave,
} from "../../../services/draft-save-lifecycle";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Userscript } from "@shared/model";
import { setCurrentUserscript } from "../userscripts";
import { persistScriptBuffers } from "../userscripts/thunks.userscripts";
import {
  commitDraftForSave,
  removeDraft,
  syncDraftFromRemoteScript,
  enqueueConflict,
} from "./actions";
import {
  applyCommitDraftForSave,
  applyFlushModelToDraft,
  applyResolveAllConflictsTakeRemote,
  applyResolveConflictKeepLocal,
  applyResolveConflictTakeRemote,
  applyUpdateDraftBuffer,
} from "./editor-drafts-transitions";
import {
  bumpDraftRevision,
  draftFromScript,
  DraftBuffer,
  EditorDraft,
  initialState,
  isDraftDirty,
  RemoteDraftConflict,
} from "./state.editor-drafts";

function ensureDraftFromScript(
  state: typeof initialState,
  script: Userscript
): EditorDraft {
  const existing = state.drafts[script.id];

  if (existing) {
    return existing;
  }

  const created = draftFromScript(script);
  state.drafts[script.id] = created;
  return created;
}

function pruneCleanDrafts(
  state: typeof initialState,
  keepScriptIds: Iterable<string>
) {
  const keep = new Set(keepScriptIds);

  for (const scriptId of Object.keys(state.drafts)) {
    if (keep.has(scriptId)) {
      continue;
    }

    if (!isDraftDirty(state.drafts[scriptId])) {
      delete state.drafts[scriptId];
    }
  }
}

const editorDraftsSlice = createSlice({
  name: "editorDrafts",
  initialState,
  reducers: {
    /**
     * Ensure an open-document draft exists for a script (lazy create).
     */
    ensureDraft: {
      prepare: (script: Userscript) => ({ payload: script }),
      reducer: (state, action: PayloadAction<Userscript>) => {
        ensureDraftFromScript(state, action.payload);
      },
    },
    updateDraftBuffer: {
      prepare: (args: {
        scriptId: string;
        buffer: DraftBuffer;
        code: string;
      }) => ({ payload: args }),
      reducer: (
        state,
        action: PayloadAction<{
          scriptId: string;
          buffer: DraftBuffer;
          code: string;
        }>
      ) => {
        const { scriptId, buffer, code } = action.payload;
        const draft = state.drafts[scriptId];

        if (!draft) {
          return;
        }

        applyUpdateDraftBuffer(draft, buffer, code);
      },
    },
    resolveConflictKeepLocal: {
      prepare: (observation: {
        scriptId: string;
        conflictId: string | null;
      }) => ({
        payload: observation,
      }),
      reducer: (
        state,
        action: PayloadAction<{ scriptId: string; conflictId: string | null }>
      ) => {
        applyResolveConflictKeepLocal(
          state.pendingConflicts,
          action.payload.scriptId,
          action.payload.conflictId
        );
      },
    },
    resolveConflictTakeRemote: {
      prepare: (script: Userscript) => ({ payload: script }),
      reducer: (state, action: PayloadAction<Userscript>) => {
        applyResolveConflictTakeRemote(state, action.payload);
      },
    },
    resolveAllConflictsTakeRemote: {
      prepare: (scripts: Userscript[]) => ({ payload: scripts }),
      reducer: (state, action: PayloadAction<Userscript[]>) => {
        applyResolveAllConflictsTakeRemote(state, action.payload);
      },
    },
    flushModelToDraft: {
      prepare: (args: {
        scriptId: string;
        buffer: DraftBuffer;
        code: string;
      }) => ({ payload: args }),
      reducer: (
        state,
        action: PayloadAction<{
          scriptId: string;
          buffer: DraftBuffer;
          code: string;
        }>
      ) => {
        const { scriptId, buffer, code } = action.payload;
        const draft = state.drafts[scriptId];

        if (!draft) {
          return;
        }

        applyFlushModelToDraft(draft, buffer, code);
      },
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncDraftFromRemoteScript, (state, action) => {
        const script = action.payload;
        const existing = state.drafts[script.id];
        if (existing) {
          state.drafts[script.id] = bumpDraftRevision(existing, script);
        }
      })
      .addCase(removeDraft, (state, action) => {
        delete state.drafts[action.payload];
        delete state.pendingConflicts[action.payload];
      })
      .addCase(enqueueConflict, (state, action) => {
        const previous = state.pendingConflicts[action.payload.scriptId];
        const { conflictId: _newId, ...observation } = action.payload;
        const { conflictId: _oldId, ...previousObservation } = previous ?? {};
        if (
          JSON.stringify(observation) !== JSON.stringify(previousObservation)
        ) {
          state.pendingConflicts[action.payload.scriptId] = action.payload;
        }
      })
      .addCase(commitDraftForSave, (state, action) => {
        const { scriptId, buffer, code, saveRequestId, snapshotCode } =
          action.payload;
        const draft = state.drafts[scriptId];

        if (!draft) {
          return;
        }

        applyCommitDraftForSave(
          draft,
          buffer,
          code,
          saveRequestId,
          snapshotCode
        );
      })
      .addCase(setCurrentUserscript, (state, action) => {
        // Draft ensure for the newly selected script happens in the listener
        // (needs the userscripts entity). Here we only prune clean offscreen
        // drafts so the map stays open-document sized.
        pruneCleanDrafts(state, [
          action.payload.id,
          ...Object.keys(state.drafts).filter((scriptId) =>
            isDraftDirty(state.drafts[scriptId])
          ),
        ]);
      })
      .addCase(acceptPublishedScript, (state, action) => {
        const { script, kind } = action.payload;
        if (kind === "created" || kind === "imported") {
          // A storage echo may already have opened the draft while writes ran.
          ensureDraftFromScript(state, script);
        }
      })
      .addCase(acceptDeletedScript, (state, action) => {
        delete state.drafts[action.payload];
        delete state.pendingConflicts[action.payload];
      })
      .addCase(persistScriptBuffers.fulfilled, (state, action) => {
        completeDraftSave(
          state,
          action.payload.script,
          action.meta.requestId,
          action.payload.conflictId
        );
      })
      .addCase(persistScriptBuffers.rejected, (state, action) => {
        rejectDraftSave(state, action.meta.arg.scriptId, action.meta.requestId);
      });
  },
});

export const {
  ensureDraft,
  updateDraftBuffer,
  resolveConflictKeepLocal,
  resolveConflictTakeRemote,
  resolveAllConflictsTakeRemote,
  flushModelToDraft,
} = editorDraftsSlice.actions;

export {
  commitDraftForSave,
  removeDraft,
  syncDraftFromRemoteScript,
  enqueueConflict,
} from "./actions";

export {
  buildScriptWithDraftSource,
  detectDraftConflict,
  extractUserscriptMetadataUpdates,
  getDraftOrSavedSource,
} from "./helpers";

export {
  selectDraftForScript,
  selectIsDraftDirty,
  selectPendingConflicts,
} from "./selectors";

export { isDraftDirty, draftFromScript };
export type { DraftBuffer, EditorDraft, RemoteDraftConflict };

export {
  draftBufferForCodeLanguage,
  shouldRestoreDirtyOnSaveRejection,
} from "./state.editor-drafts";

export {
  applyUpdateDraftBuffer,
  applyFlushModelToDraft,
  applyCommitDraftForSave,
  nextDraftFromRemoteScript,
} from "./editor-drafts-transitions";

export default editorDraftsSlice.reducer;
