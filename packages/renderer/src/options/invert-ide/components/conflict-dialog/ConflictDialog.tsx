import { Button } from "@/shared/components/button/Button";
import { Dialog } from "@/shared/components/dialog/Dialog";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  DraftBuffer,
  resolveAllConflictsTakeRemote,
  resolveConflictTakeRemote,
  selectPendingConflicts,
} from "@/shared/store/slices/editor-drafts";
import {
  keepAllLocalConflictsAndPersist,
  keepLocalConflictAndPersist,
} from "@/shared/store/slices/editor-drafts/thunks.conflicts";
import { useEffect, useMemo, useState } from "react";
import {
  getConflictDialogCloseAction,
  getPersistErrorMessage,
  isConflictDialogOpen,
} from "./conflict-dialog-state";

const BUFFER_LABELS: Record<DraftBuffer, string> = {
  typescript: "TypeScript",
  scss: "SCSS",
  typeDefinitions: "Type definitions",
};

function truncatePreview(text: string, maxLength = 120): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized || "(empty)";
  }

  return `${normalized.slice(0, maxLength)}…`;
}

export function ConflictDialog() {
  const dispatch = useAppDispatch();
  const conflicts = useAppSelector(selectPendingConflicts);
  const conflictList = useMemo(() => Object.values(conflicts), [conflicts]);
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  const open = isConflictDialogOpen(
    conflictList.map((conflict) => conflict.conflictId),
    dismissedIds
  );

  useEffect(() => {
    if (!open) {
      setPersistError(null);
    }
  }, [open]);

  // Taking remote replaces the drafts (clean, revision-bumped); the
  // WorkspaceService observes the store change and updates the Monaco models,
  // including ones attached to open editors.
  const onTakeRemote = (scriptId: string) => {
    const conflict = conflicts[scriptId];

    if (!conflict) {
      return;
    }

    setPersistError(null);
    dispatch(resolveConflictTakeRemote(conflict.remoteScript));
  };

  const onKeepLocal = async (scriptId: string) => {
    setIsPersisting(true);
    setPersistError(null);

    try {
      await dispatch(keepLocalConflictAndPersist(scriptId)).unwrap();
    } catch (error) {
      console.error("Failed to persist local draft for conflict:", error);
      setPersistError(getPersistErrorMessage(error));
    } finally {
      setIsPersisting(false);
    }
  };

  const onTakeAllRemote = () => {
    const scripts = conflictList.map((conflict) => conflict.remoteScript);

    setPersistError(null);
    dispatch(resolveAllConflictsTakeRemote(scripts));
  };

  const onKeepAllLocal = async () => {
    setIsPersisting(true);
    setPersistError(null);

    try {
      await dispatch(keepAllLocalConflictsAndPersist()).unwrap();
    } catch (error) {
      console.error("Failed to persist local drafts for conflicts:", error);
      setPersistError(getPersistErrorMessage(error));
    } finally {
      setIsPersisting(false);
    }
  };

  // Leaves every draft and pending conflict as it is, without saving.
  const onDismiss = () => {
    setDismissedIds(
      new Set(conflictList.map((conflict) => conflict.conflictId))
    );
    setPersistError(null);
  };

  const onClose = () => {
    const action = getConflictDialogCloseAction(isPersisting, persistError);

    if (action === "dismiss") {
      onDismiss();
    } else if (action === "keep-all-local") {
      void onKeepAllLocal();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Storage sync conflict"
      minWidth="32rem"
    >
      <div className="flex flex-col gap-md">
        <Typography variant="body" className="text-text-muted">
          Another browser or tab updated saved script content while you have
          unsaved local edits. Keep local saves your draft against this observed
          version. Take remote loads the saved version into the editor.
          {persistError === null &&
            " Closing this dialog keeps all local drafts."}
        </Typography>

        {persistError !== null && (
          <div
            role="alert"
            className="flex flex-col gap-sm rounded-default border border-error-border bg-error-surface px-md py-sm text-xs text-error-accent"
          >
            <span className="font-semibold">
              Couldn’t save your local draft: {persistError}
            </span>
            <span>
              Your edits are still in the editor, unsaved. Try again, take
              remote, or close without saving to leave this conflict unresolved.
            </span>
            <div>
              <Button variant="secondary" onClick={onDismiss}>
                Close without saving
              </Button>
            </div>
          </div>
        )}

        <div className="flex max-h-[50vh] flex-col gap-sm overflow-y-auto">
          {conflictList.map((conflict) => (
            <div
              key={conflict.scriptId}
              className="rounded-default border border-border bg-surface-raised p-sm"
            >
              <Typography
                variant="section-title"
                className="mb-sm block font-mono"
              >
                {conflict.scriptName}
              </Typography>

              {conflict.buffers.map((entry) => (
                <div key={entry.buffer} className="mb-sm last:mb-0">
                  <Typography
                    variant="caption"
                    className="mb-1 block text-text-muted"
                  >
                    {BUFFER_LABELS[entry.buffer]}
                  </Typography>
                  <div className="grid gap-1 font-mono text-xs">
                    <div>
                      <span className="text-syntax-keyword">local</span>{" "}
                      {truncatePreview(entry.local)}
                    </div>
                    <div>
                      <span className="text-syntax-function">remote</span>{" "}
                      {truncatePreview(entry.remote)}
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-sm flex gap-sm">
                <Button
                  variant="secondary"
                  disabled={isPersisting}
                  onClick={() => void onKeepLocal(conflict.scriptId)}
                >
                  Keep local
                </Button>
                <Button
                  variant="primary"
                  disabled={isPersisting}
                  onClick={() => onTakeRemote(conflict.scriptId)}
                >
                  Take remote
                </Button>
              </div>
            </div>
          ))}
        </div>

        {conflictList.length > 1 && (
          <div className="flex justify-end gap-sm border-t border-border-subtle pt-sm">
            <Button
              variant="secondary"
              disabled={isPersisting}
              onClick={() => void onKeepAllLocal()}
            >
              Keep all local
            </Button>
            <Button
              variant="primary"
              disabled={isPersisting}
              onClick={onTakeAllRemote}
            >
              Take all remote
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
