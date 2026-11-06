import { Userscript } from "@shared/model";
import {
  bumpDraftRevision,
  draftFromScript,
  DraftBuffer,
  EditorDraft,
  EditorDraftsState,
  isDraftDirty,
  PendingDraftConflict,
} from "./state.editor-drafts";

/**
 * Apply an editor edit to a draft buffer. No-ops when the code is unchanged.
 * Returns true when the draft was mutated.
 */
export function applyUpdateDraftBuffer(
  draft: EditorDraft,
  buffer: DraftBuffer,
  code: string
): boolean {
  if (draft[buffer] === code) {
    return false;
  }

  draft[buffer] = code;
  draft.dirty[buffer] = true;
  draft.revision += 1;
  return true;
}

/**
 * Flush Monaco model text into a draft before a script switch / model reconcile.
 * Always marks dirty and bumps revision when the buffer differs so WorkspaceService
 * sees the update and will not overwrite the attached model with a stale draft.
 * Returns true when the draft was mutated.
 */
export function applyFlushModelToDraft(
  draft: EditorDraft,
  buffer: DraftBuffer,
  code: string
): boolean {
  if (draft[buffer] === code) {
    return false;
  }

  draft[buffer] = code;
  draft.dirty[buffer] = true;
  draft.revision += 1;
  return true;
}

/**
 * Record an in-flight save request id and clear dirty for the committed buffer.
 * Always stores saveRequestId. Only mutates code/dirty/revision when the buffer
 * still needs a commit (code differs or still dirty).
 * Returns true when code/dirty/revision changed (request id is always written).
 */
export function applyCommitDraftForSave(
  draft: EditorDraft,
  buffer: DraftBuffer,
  code: string,
  saveRequestId: string,
  snapshotCode?: string
): boolean {
  draft.lastSaveRequestId[buffer] = saveRequestId;
  (draft.saveBaseline ??= {})[buffer] = draft.lastSynced[buffer];

  if (snapshotCode !== undefined && draft[buffer] !== snapshotCode) {
    // Saving an older snapshot must not erase edits made while compiling.
    draft.lastSynced[buffer] = code;
    draft.dirty[buffer] = draft[buffer] !== code;
    draft.revision += 1;
    return true;
  }

  if (draft[buffer] === code && !draft.dirty[buffer]) {
    return false;
  }

  draft[buffer] = code;
  draft.dirty[buffer] = false;
  draft.lastSynced[buffer] = code;
  draft.revision += 1;
  return true;
}

/** Drop rollback baselines owned by a request whose write landed or failed. */
export function clearSaveBaseline(draft: EditorDraft, requestId: string): void {
  if (!draft.saveBaseline) {
    return;
  }

  for (const buffer of Object.keys(draft.saveBaseline) as DraftBuffer[]) {
    if (draft.lastSaveRequestId[buffer] === requestId) {
      delete draft.saveBaseline[buffer];
    }
  }

  if (Object.keys(draft.saveBaseline).length === 0) {
    delete draft.saveBaseline;
  }
}

/**
 * Merge a conflict-free remote observation into a draft with unsaved edits:
 * clean buffers take the remote text, and every baseline moves to remote. Only
 * valid without a conflict, where a dirty buffer's remote either matches its
 * local text or its existing baseline.
 */
export function applyMergeRemoteIntoDraft(
  draft: EditorDraft,
  script: Userscript
): void {
  const remote: Record<DraftBuffer, string> = {
    typescript: script.code.source.typescript,
    scss: script.code.source.scss,
    typeDefinitions: script.typeDefinitions ?? "",
  };
  let changed = false;

  for (const buffer of Object.keys(remote) as DraftBuffer[]) {
    if (draft.lastSynced[buffer] !== remote[buffer]) {
      draft.lastSynced[buffer] = remote[buffer];
      delete draft.lastSaveRequestId[buffer];
      delete draft.saveBaseline?.[buffer];
      changed = true;
    }

    if (!draft.dirty[buffer] && draft[buffer] !== remote[buffer]) {
      draft[buffer] = remote[buffer];
      changed = true;
    }
  }

  if (script.storageRevision) {
    draft.baseSavedRevision = script.storageRevision;
  }

  if (changed) {
    draft.revision += 1;
  }
}

/**
 * Drop clean drafts outside the keep set, so the map stays open-document sized.
 * A clean draft with a save in flight stays: a failed write restores its edits.
 */
export function applyPruneCleanDrafts(
  state: EditorDraftsState,
  keepScriptIds: Iterable<string>
): void {
  const keep = new Set(keepScriptIds);

  for (const scriptId of Object.keys(state.drafts)) {
    if (keep.has(scriptId) || state.inFlightSaves?.[scriptId]) {
      continue;
    }

    if (!isDraftDirty(state.drafts[scriptId])) {
      delete state.drafts[scriptId];
    }
  }
}

export function applySaveStarted(
  state: EditorDraftsState,
  scriptId: string
): void {
  const inFlightSaves = (state.inFlightSaves ??= {});
  inFlightSaves[scriptId] = (inFlightSaves[scriptId] ?? 0) + 1;
}

export function applySaveSettled(
  state: EditorDraftsState,
  scriptId: string
): void {
  const remaining = (state.inFlightSaves?.[scriptId] ?? 0) - 1;

  if (remaining > 0) {
    state.inFlightSaves[scriptId] = remaining;
  } else {
    delete state.inFlightSaves?.[scriptId];
  }
}

/**
 * Replace a draft from a remote script, bumping revision when one already exists.
 */
export function nextDraftFromRemoteScript(
  existing: EditorDraft | undefined,
  script: Userscript
): EditorDraft {
  return existing
    ? bumpDraftRevision(existing, script)
    : draftFromScript(script);
}

/**
 * Apply a remote script and clear any pending conflict for that script.
 */
export function applyRemoteScriptAndClearConflict(
  state: EditorDraftsState,
  script: Userscript
): void {
  state.drafts[script.id] = nextDraftFromRemoteScript(
    state.drafts[script.id],
    script
  );
  delete state.pendingConflicts[script.id];
}

/**
 * Keep local draft; only drop the pending conflict entry.
 */
export function applyResolveConflictKeepLocal(
  pendingConflicts: Record<string, PendingDraftConflict>,
  scriptId: string,
  conflictId: string | null
): void {
  if (
    conflictId !== null &&
    pendingConflicts[scriptId]?.conflictId === conflictId
  ) {
    delete pendingConflicts[scriptId];
  }
}

/**
 * Take remote script contents into the draft and clear the conflict.
 */
export function applyResolveConflictTakeRemote(
  state: EditorDraftsState,
  script: Userscript
): void {
  applyRemoteScriptAndClearConflict(state, script);
}

/**
 * Take remote for many scripts and clear each conflict.
 */
export function applyResolveAllConflictsTakeRemote(
  state: EditorDraftsState,
  scripts: Userscript[]
): void {
  for (const script of scripts) {
    applyRemoteScriptAndClearConflict(state, script);
  }
}

/**
 * Restore dirty, and the baseline of an unwritten commit, after a rejected save
 * when the request id is still current. Returns true when dirty was restored.
 */
export function applySaveRejectionDirtyRestore(
  draft: EditorDraft,
  buffer: DraftBuffer,
  rejectedRequestId: string
): boolean {
  if (draft.lastSaveRequestId[buffer] !== rejectedRequestId) {
    return false;
  }

  const baseline = draft.saveBaseline?.[buffer];
  if (baseline !== undefined) {
    draft.lastSynced[buffer] = baseline;
  }

  draft.dirty[buffer] = true;
  draft.revision += 1;
  return true;
}
