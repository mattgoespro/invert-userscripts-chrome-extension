import { Userscript } from "@shared/model";
import { detectDraftConflict } from "./helpers";
import {
  DraftBuffer,
  EditorDraft,
  RemoteDraftConflict,
  isDraftDirty,
} from "./state.editor-drafts";

export type StorageSyncDecision =
  | { action: "keep-dirty-orphan" }
  | { action: "remove" }
  | { action: "sync"; script: Userscript }
  /** Update the entity only; leave an absent or dirty draft untouched. */
  | { action: "sync-entity"; script: Userscript }
  /** Update the entity and merge remote into a dirty draft's clean buffers. */
  | { action: "merge-clean"; script: Userscript }
  | { action: "conflict"; conflict: RemoteDraftConflict };

/**
 * Decides how a storage-sync refresh should treat one script id given the
 * remote manifest entry (if any) and the local draft (if any).
 *
 * - Missing remote + dirty local → keep the orphan draft (user still editing)
 * - Missing remote + clean/absent local → remove the draft
 * - Present remote + no local → sync entity only (drafts are created on open)
 * - Present remote + dirty conflict → enqueue conflict
 * - Present remote + dirty, no conflict, same sources → sync entity only (remote
 *   snapshot); draft buffers stay as the open overlay (never merged onto the entity)
 * - Present remote + dirty, no conflict, new sources → merge into clean buffers,
 *   so a later save cannot write their old values back
 * - Present remote + no conflict → sync from remote (may overwrite clean draft)
 */
export function decideStorageSyncAction(
  scriptId: string,
  localDraft: EditorDraft | undefined,
  remoteScript: Userscript | undefined
): StorageSyncDecision {
  if (!remoteScript) {
    if (localDraft && isDraftDirty(localDraft)) {
      return { action: "keep-dirty-orphan" };
    }

    return { action: "remove" };
  }

  if (!localDraft) {
    return { action: "sync-entity", script: remoteScript };
  }

  const conflict = detectDraftConflict(scriptId, localDraft, remoteScript);

  if (conflict) {
    return { action: "conflict", conflict };
  }

  if (isDraftDirty(localDraft)) {
    // Entity stays the remote/persisted snapshot; UI reads buffers via drafts.
    return hasNewRemoteSource(localDraft, remoteScript)
      ? { action: "merge-clean", script: remoteScript }
      : { action: "sync-entity", script: remoteScript };
  }

  return { action: "sync", script: remoteScript };
}

function hasNewRemoteSource(
  draft: EditorDraft,
  remoteScript: Userscript
): boolean {
  const remote: Record<DraftBuffer, string> = {
    typescript: remoteScript.code.source.typescript,
    scss: remoteScript.code.source.scss,
    typeDefinitions: remoteScript.typeDefinitions ?? "",
  };

  return (Object.keys(remote) as DraftBuffer[]).some(
    (buffer) =>
      draft.lastSynced[buffer] !== remote[buffer] ||
      (!draft.dirty[buffer] && draft[buffer] !== remote[buffer])
  );
}
