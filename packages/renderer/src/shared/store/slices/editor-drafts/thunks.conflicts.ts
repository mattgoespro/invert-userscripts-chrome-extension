import { createAction, createAsyncThunk } from "@reduxjs/toolkit";
import { persistScriptBuffers } from "../userscripts/thunks.userscripts";
import type { RootState } from "../../store";

/** Keep action types stable with the editorDrafts slice reducers. */
interface ConflictObservation {
  scriptId: string;
  conflictId: string | null;
}

const resolveConflictKeepLocal = createAction<ConflictObservation>(
  "editorDrafts/resolveConflictKeepLocal"
);

/**
 * Persist local draft buffers to sync, then clear the conflict. This makes
 * "Keep local" overwrite remote without requiring a separate Save.
 */
export const keepLocalConflictAndPersist = createAsyncThunk<
  void,
  string,
  { state: RootState }
>(
  "editorDrafts/keepLocalConflictAndPersist",
  async (scriptId, { dispatch, getState }) => {
    const conflictId =
      getState().editorDrafts.pendingConflicts[scriptId]?.conflictId ?? null;
    await dispatch(persistScriptBuffers({ scriptId, conflictId })).unwrap();
    dispatch(resolveConflictKeepLocal({ scriptId, conflictId }));
  }
);

export const keepAllLocalConflictsAndPersist = createAsyncThunk<
  void,
  void,
  { state: RootState }
>(
  "editorDrafts/keepAllLocalConflictsAndPersist",
  async (_arg, { dispatch, getState }) => {
    const observations = Object.values(
      getState().editorDrafts.pendingConflicts
    ).map(({ scriptId, conflictId }) => ({
      scriptId,
      conflictId: conflictId ?? null,
    }));

    for (const observation of observations) {
      const current =
        getState().editorDrafts.pendingConflicts[observation.scriptId];
      if (!current || current.conflictId !== observation.conflictId) {
        continue;
      }
      await dispatch(persistScriptBuffers(observation)).unwrap();
      dispatch(resolveConflictKeepLocal(observation));
    }
  }
);
