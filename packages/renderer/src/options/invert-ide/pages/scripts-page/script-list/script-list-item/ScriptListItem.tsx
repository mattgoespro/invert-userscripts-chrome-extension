import { Switch } from "@/shared/components/switch/Switch";
import { useAppDispatch } from "@/shared/store/hooks";
import { setCurrentUserscript } from "@/shared/store/slices/userscripts";
import { Userscript } from "@shared/model";
import { PackageIcon } from "lucide-react";
import { toggleUserscript } from "@/shared/store/slices/userscripts/thunks.userscripts";
import clsx from "clsx";

type ScriptListItemProps = {
  script: Userscript;
  active: boolean;
  onScriptSelected: (scriptId: string) => void;
};

export function ScriptListItem({
  script,
  active,
  onScriptSelected,
}: ScriptListItemProps) {
  const dispatch = useAppDispatch();

  const onSelectScript = () => {
    if (active) {
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
        "flex items-center p-2 mb-1.5 rounded-default bg-surface-overlay border border-transparent cursor-pointer transition-colors duration-150",
        "hover:bg-hover-overlay hover:border-border",
        "focus:outline-none focus:border-accent-border",
        active &&
          "bg-accent-subtle border-accent-muted border-l-3 border-l-accent",
        script.error && "border-error"
      )}
      onClick={() => onSelectScript()}
    >
      {script.status === "modified" && (
        <div className="w-2 h-2 bg-accent rounded-full mr-3 shrink-0 animate-pulse-indicator" />
      )}
      {script.shared && (
        <PackageIcon
          size={12}
          className="shrink-0 mr-2 text-syntax-keyword opacity-70"
        />
      )}
      <span
        className={clsx(
          "font-mono text-[11px] font-medium flex-1 whitespace-nowrap overflow-hidden text-ellipsis",
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
