import clsx from "clsx";
import type { DrivePhase } from "@shared/storage/drive-sync";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectIsDraftDirty } from "@/shared/store/slices/editor-drafts";
import {
  selectActiveSidebarTab,
  setActiveSidebarTab,
} from "@/shared/store/slices/ui";
import { selectCurrentUserscript } from "@/shared/store/slices/userscripts";
import { selectErrorCount } from "@/shared/store/slices/workspace";
import { useDriveSyncStatus } from "../../hooks/useDriveSyncStatus";
import { describeRunAt } from "../../shared/run-at";

const DRIVE_TONE: Record<DrivePhase, string> = {
  disconnected: "text-text-muted-strong",
  "setup-required": "text-text-muted-strong",
  "connect-required": "text-text-muted-strong",
  "reconnect-required": "text-warning",
  "account-mismatch": "text-warning",
  restoring: "text-text-muted",
  syncing: "text-text-muted",
  offline: "text-warning",
  pending: "text-text-muted",
  conflict: "text-warning",
  synced: "text-success",
  error: "text-danger",
};

const itemClass = "flex shrink-0 items-center gap-1.5 whitespace-nowrap";

export function StatusBar() {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(selectActiveSidebarTab);
  const script = useAppSelector(selectCurrentUserscript);
  const scriptId = script?.id ?? "";
  const isDirty = useAppSelector(selectIsDraftDirty(scriptId));
  const problemCount = useAppSelector((state) =>
    selectErrorCount(state, scriptId)
  );
  const drive = useDriveSyncStatus();
  const showScript = activeTab === "scripts" && !!script;

  return (
    <footer
      aria-label="Status"
      className="flex h-7 shrink-0 items-center gap-lg border-t border-border bg-surface-chrome px-md text-xs text-text-muted"
    >
      {showScript && (
        <>
          <span
            className={clsx(
              itemClass,
              isDirty ? "text-accent" : "text-success"
            )}
          >
            <span
              aria-hidden
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                isDirty ? "bg-accent" : "bg-success"
              )}
            />
            {isDirty ? "Unsaved changes" : "Saved"}
          </span>
          <span
            className={clsx(
              itemClass,
              problemCount > 0 ? "text-error-accent" : "text-text-muted-strong"
            )}
          >
            {problemCount === 0
              ? "No problems"
              : `${problemCount} problem${problemCount === 1 ? "" : "s"}`}
          </span>
        </>
      )}
      {drive && (
        <button
          type="button"
          onClick={() => dispatch(setActiveSidebarTab("settings"))}
          className={clsx(
            itemClass,
            "min-w-0 cursor-pointer truncate hover:underline focus-visible:outline-2 focus-visible:outline-accent",
            DRIVE_TONE[drive.phase]
          )}
          title="Show Drive sync details"
        >
          <span className="truncate">
            {drive.pending > 0 && drive.phase !== "conflict"
              ? `${drive.pending} change${drive.pending === 1 ? "" : "s"} waiting to upload`
              : drive.message}
          </span>
        </button>
      )}
      <div className="flex-1" />
      {showScript && (
        <>
          <span className={clsx(itemClass, "text-text-muted-strong")}>
            {script.enabled ? "On" : "Off"},{" "}
            {describeRunAt(script.runAt).toLowerCase()}
          </span>
          <span className={clsx(itemClass, "text-text-muted-strong")}>
            TypeScript and SCSS
          </span>
        </>
      )}
    </footer>
  );
}
