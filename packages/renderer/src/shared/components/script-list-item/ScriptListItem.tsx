import { Switch } from "@/shared/components/switch/Switch";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { selectIsDraftDirty } from "@/shared/store/slices/editor-drafts/selectors";
import {
  describeApplyResult,
  formatMatchingTabsToast,
} from "@/shared/store/slices/userscripts/messaging";
import { toggleUserscript } from "@/shared/store/slices/userscripts/thunks.crud";
import { Userscript } from "@shared/model";
import { selectErrorCount } from "@/shared/store/slices/workspace";
import { summarizeUrlPatterns } from "@/shared/utils/script-site";
import { PackageIcon } from "lucide-react";
import clsx from "clsx";
import { useDispatch, useSelector } from "react-redux";

type WorkspaceRoot = Parameters<typeof selectErrorCount>[0];

type ScriptListItemProps = {
  script: Userscript;
  active?: boolean;
  onScriptSelected?: (scriptId: string) => void;
};

type ToggleResult = {
  script: Userscript;
  appliedTabCount: number;
  removedTabCount: number;
  applySuccess?: boolean;
  staleSkipCount?: number;
};

type ThunkDispatch = {
  (action: unknown): {
    unwrap: () => Promise<ToggleResult>;
  };
};

export function ScriptListItem({
  script,
  active = false,
  onScriptSelected,
}: ScriptListItemProps) {
  // Shared by IDE store and compile-free popup store (both have thunk middleware).
  const dispatch = useDispatch() as unknown as ThunkDispatch;
  const isModified = useSelector(selectIsDraftDirty(script.id));
  // The popup store has no workspace slice, so problems are only counted in the IDE.
  const problemCount = useSelector((state: Partial<WorkspaceRoot>) =>
    state.workspace ? selectErrorCount(state as WorkspaceRoot, script.id) : 0
  );
  const { toast } = useToast();

  const onSelectScript = () => {
    if (!onScriptSelected || active) {
      return;
    }

    onScriptSelected(script.id);
  };

  const onToggleScript = async () => {
    try {
      const payload = await dispatch(toggleUserscript(script.id)).unwrap();
      const enabled = payload.script.enabled;

      if (!enabled) {
        toast({
          variant: "info",
          message: formatMatchingTabsToast(
            payload.removedTabCount,
            "Removed from"
          ),
        });
        return;
      }

      const feedback = describeApplyResult({
        success: payload.applySuccess !== false,
        appliedTabCount: payload.appliedTabCount,
        staleSkipCount: payload.staleSkipCount,
      });

      toast({
        variant: feedback.variant,
        message: feedback.message,
      });
    } catch (error) {
      console.error("Failed to toggle userscript:", error);
      toast({
        variant: "error",
        message: "Failed to update script enabled state.",
      });
    }
  };

  return (
    <div
      className={clsx(
        "group grid cursor-default grid-cols-[minmax(0,1fr)_auto] items-center gap-x-sm border-l-[3px] py-1.5 pr-md pl-[calc(var(--spacing-md)-3px)] transition-colors duration-150",
        onScriptSelected && "cursor-pointer",
        active
          ? "border-l-accent bg-selected"
          : "border-l-transparent hover:bg-hover-overlay"
      )}
      onClick={() => onSelectScript()}
    >
      <span
        className={clsx(
          "overflow-hidden text-base text-ellipsis whitespace-nowrap",
          active ? "font-semibold" : "font-medium",
          script.enabled ? "text-foreground" : "text-text-muted-strong"
        )}
      >
        {script.name}
      </span>
      <div className="row-span-2 flex items-center gap-2">
        {isModified && (
          <span
            className="h-2 w-2 shrink-0 animate-pulse-indicator rounded-full bg-accent"
            title="Unsaved changes"
          >
            <span className="sr-only">Unsaved changes</span>
          </span>
        )}
        {problemCount > 0 && (
          <span
            className="rounded-full bg-error-accent px-1.5 text-[11px] leading-4 font-bold text-on-accent tabular-nums"
            title={`${problemCount} problem${problemCount === 1 ? "" : "s"}`}
          >
            {problemCount}
          </span>
        )}
        <Switch checked={script.enabled} onChange={() => onToggleScript()} />
      </div>
      <p className="flex min-w-0 items-center gap-1 font-mono text-[11px] leading-4 text-text-muted-strong">
        {script.shared && (
          <PackageIcon
            size={11}
            className="shrink-0 text-syntax-keyword"
            aria-label="Shared module"
          />
        )}
        <span className="truncate">
          {summarizeUrlPatterns(script.urlPatterns)}
        </span>
      </p>
    </div>
  );
}
