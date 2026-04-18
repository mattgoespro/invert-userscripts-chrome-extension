import { Switch } from "@/shared/components/switch/Switch";
import { useAppDispatch } from "@/shared/store/hooks";
import { setCurrentUserscript } from "@/shared/store/slices/userscripts";
import { Userscript } from "@shared/model";
import { PackageIcon } from "lucide-react";
import { toggleUserscript } from "@/shared/store/slices/userscripts/thunks.userscripts";
import clsx from "clsx";

type ScriptListItemProps = {
  script: Userscript;
  active?: boolean;
  onScriptSelected?: (scriptId: string) => void;
};

export function ScriptListItem({
  script,
  active = false,
  onScriptSelected,
}: ScriptListItemProps) {
  const dispatch = useAppDispatch();

  const onSelectScript = () => {
    if (!onScriptSelected || active) {
      return;
    }

    dispatch(setCurrentUserscript(script.id));
    onScriptSelected(script.id);
  };

  const onToggleScript = () => {
    dispatch(toggleUserscript(script.id));
  };

  return (
    <div
      className={clsx(
        "group mb-1.5 flex items-center rounded-default p-2 transition-colors duration-150",
        onScriptSelected && "cursor-pointer",
        active
          ? "border border-l-[3px] border-accent-muted border-l-accent bg-accent-subtle"
          : "border border-transparent bg-surface-overlay hover:border-border hover:bg-hover-overlay",
        "focus:border-accent-border focus:outline-none",
        script.error && "border-error"
      )}
      onClick={() => onSelectScript()}
    >
      {script.status === "modified" && (
        <div className="mr-3 h-2 w-2 shrink-0 animate-pulse-indicator rounded-full bg-accent" />
      )}
      {script.shared && (
        <PackageIcon
          size={12}
          className="mr-2 shrink-0 text-syntax-keyword opacity-70"
        />
      )}
      <span
        className={clsx(
          "flex-1 overflow-hidden font-mono text-base font-medium text-ellipsis whitespace-nowrap",
          script.shared ? "text-syntax-keyword" : "text-syntax-function"
        )}
      >
        {script.name}
      </span>
      <div className="flex items-center gap-2 opacity-70 transition-opacity duration-150 group-hover:opacity-100">
        <Switch checked={script.enabled} onChange={() => onToggleScript()} />
      </div>
    </div>
  );
}
