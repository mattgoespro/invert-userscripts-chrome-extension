import { Button } from "@/shared/components/button/Button";
import { Dialog } from "@/shared/components/dialog/Dialog";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectCurrentUserscript } from "@/shared/store/slices/userscripts";
import {
  DraftBuffer,
  resolveAllConflictsKeepLocal,
  resolveAllConflictsTakeRemote,
  resolveConflictKeepLocal,
  resolveConflictTakeRemote,
  selectPendingConflicts,
} from "@/shared/store/slices/editor-drafts";
import { syncAllSharedScriptLibsFromUserscripts } from "@packages/monaco";
import { disposeModelsForScript } from "../code-editor/model-cache";
import { useMemo } from "react";

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
  const currentScript = useAppSelector(selectCurrentUserscript);
  const conflictList = useMemo(() => Object.values(conflicts), [conflicts]);

  const open = conflictList.length > 0;

  const onTakeRemote = (scriptId: string) => {
    const conflict = conflicts[scriptId];

    if (!conflict) {
      return;
    }

    dispatch(resolveConflictTakeRemote(conflict.remoteScript));
    syncAllSharedScriptLibsFromUserscripts([conflict.remoteScript]);

    if (currentScript?.id === scriptId) {
      disposeModelsForScript(conflict.remoteScript);
    }
  };

  const onKeepLocal = (scriptId: string) => {
    dispatch(resolveConflictKeepLocal(scriptId));
  };

  const onTakeAllRemote = () => {
    const scripts = conflictList.map((conflict) => conflict.remoteScript);

    dispatch(resolveAllConflictsTakeRemote(scripts));
    syncAllSharedScriptLibsFromUserscripts(scripts);

    if (currentScript && conflicts[currentScript.id]) {
      disposeModelsForScript(currentScript);
    }
  };

  const onKeepAllLocal = () => {
    dispatch(resolveAllConflictsKeepLocal());
  };

  return (
    <Dialog
      open={open}
      onClose={onKeepAllLocal}
      title="Storage sync conflict"
      minWidth="32rem"
    >
      <div className="flex flex-col gap-md">
        <Typography variant="body" className="text-text-muted">
          Another browser or tab updated saved script content while you have
          unsaved local edits. Choose whether to keep your local draft or load
          the remote version.
        </Typography>

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
                    className="mb-1 block text-text-muted-strong"
                  >
                    {BUFFER_LABELS[entry.buffer]}
                  </Typography>
                  <div className="grid gap-1 font-mono text-xs">
                    <div>
                      <span className="text-syntax-keyword">local</span>{" "}
                      {truncatePreview(entry.local)}
                    </div>
                    <div>
                      <span className="text-syntax-string">remote</span>{" "}
                      {truncatePreview(entry.remote)}
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-sm flex gap-sm">
                <Button
                  variant="secondary"
                  onClick={() => onKeepLocal(conflict.scriptId)}
                >
                  Keep local
                </Button>
                <Button
                  variant="primary"
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
            <Button variant="secondary" onClick={onKeepAllLocal}>
              Keep all local
            </Button>
            <Button variant="primary" onClick={onTakeAllRemote}>
              Take all remote
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
