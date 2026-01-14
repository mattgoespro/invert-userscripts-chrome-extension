import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Switch } from "@/shared/components/switch/Switch";
import { useAppDispatch } from "@/shared/store/hooks";
import {
  deleteUserscript,
  selectUserscript,
  toggleUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { Userscript } from "@shared/model";
import { EllipsisIcon } from "lucide-react";
import "./ScriptListItem.scss";

type ScriptListItemProps = {
  script: Userscript;
  active: boolean;
};

export function ScriptListItem({ script, active }: ScriptListItemProps) {
  const dispatch = useAppDispatch();

  const onSelectScript = () => {
    dispatch(selectUserscript(script));
  };

  const onToggleScript = () => {
    dispatch(toggleUserscript(script.id));
  };

  const onDeleteScript = async () => {
    if (!confirm("Are you sure you want to delete this script?")) {
      return;
    }

    dispatch(deleteUserscript(script.id));
  };

  return (
    <div
      className={`script-list-item--wrapper ${active ? "active" : ""}`}
      onClick={() => onSelectScript()}
    >
      {script.status === "modified" && <div className="script-list-item--unsaved-indicator" />}
      <span className="script-list-item--name">{script.name}</span>
      <div className="script-list-item--actions">
        <Switch checked={script.enabled} onChange={() => onToggleScript()} />
        <IconButton
          icon={EllipsisIcon}
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            onDeleteScript();
          }}
          title="More"
        ></IconButton>
      </div>
    </div>
  );
}
