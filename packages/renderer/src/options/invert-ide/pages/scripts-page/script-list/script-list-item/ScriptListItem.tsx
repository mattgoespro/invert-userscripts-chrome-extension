import { Switch } from "@/shared/components/switch/Switch";
import { useAppDispatch } from "@/shared/store/hooks";
import {
  setCurrentUserscript,
  toggleUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { Userscript } from "@shared/model";
import { PackageIcon } from "lucide-react";
import "./ScriptListItem.scss";

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
      className={[
        "script-list-item--item",
        active ? "script-list-item--item-active" : null,
        script.error ? "script-list-item--item-error" : null,
        script.shared ? "script-list-item--item-shared" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelectScript()}
    >
      {script.status === "modified" && (
        <div className="script-list-item--unsaved-indicator" />
      )}
      {script.shared && (
        <PackageIcon size={12} className="script-list-item--shared-icon" />
      )}
      <span className="script-list-item--name">{script.name}</span>
      <div className="script-list-item--actions">
        <Switch checked={script.enabled} onChange={() => onToggleScript()} />
      </div>
    </div>
  );
}
