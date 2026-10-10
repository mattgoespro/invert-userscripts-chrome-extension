import { createAction, nanoid } from "@reduxjs/toolkit";
import type { Userscript } from "@shared/model";
import type { RemoteDraftConflict, DraftBuffer } from "./state.editor-drafts";

/**
 * Atomically apply the code about to be written to chrome.storage.sync and
 * clear that buffer's dirty flag. Defined outside the slice module so storage
 * thunks can dispatch it without an import cycle.
 */
export const commitDraftForSave = createAction<{
  scriptId: string;
  buffer: DraftBuffer;
  code: string;
  saveRequestId: string;
  /** Text captured before compilation/formatting; newer edits stay dirty. */
  snapshotCode?: string;
}>("editorDrafts/commitDraftForSave");

export const removeDraft = createAction<string>("editorDrafts/removeDraft");
export const syncDraftFromRemoteScript = createAction<Userscript>(
  "editorDrafts/syncDraftFromRemoteScript"
);
export const enqueueConflict = createAction(
  "editorDrafts/enqueueConflict",
  (conflict: RemoteDraftConflict) => ({
    payload: { ...conflict, conflictId: nanoid() },
  })
);
