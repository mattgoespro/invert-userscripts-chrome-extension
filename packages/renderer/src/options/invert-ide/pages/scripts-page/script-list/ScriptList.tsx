import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import "./ScriptList.scss";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Userscript } from "@shared/model";
import {
  deleteUserscript,
  selectUserscript,
  updateUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { Switch } from "@/shared/components/switch/Switch";
import { EllipsisIcon } from "lucide-react";

export function ScriptList() {
  const dispatch = useAppDispatch();
  const selectedScript = useAppSelector((state) => state.userscripts.selectedScript);
  const scripts = useAppSelector((state) => state.userscripts.scripts);

  const onSelectScript = (script: Userscript) => {
    dispatch(selectUserscript(script));
  };

  const onToggleScript = (script: Userscript) => {
    dispatch(
      updateUserscript({
        ...script,
        enabled: !script.enabled,
      })
    );
  };

  const onDeleteScript = async (scriptId: string) => {
    if (confirm("Are you sure you want to delete this script?")) {
      dispatch(deleteUserscript(scriptId));
    }
  };

  const renderScriptListItem = (script: Userscript) => {
    return (
      <div
        key={script.id}
        className={`script-list--list-item ${selectedScript?.id === script.id ? "script-list--list-item-active" : ""}`}
        onClick={() => onSelectScript(script)}
      >
        {/* {unsavedChanges.has(script.id) && <div className="script-list--list-item-unsaved" />} */}
        <span className="script-list--list-item-name">{script.name}</span>
        <div className="script-list--list-item-actions">
          <Switch checked={script.enabled} onChange={() => onToggleScript(script)} />
          <IconButton
            icon={EllipsisIcon}
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteScript(script.id);
            }}
            title="More"
          ></IconButton>
        </div>
      </div>
    );
  };

  return (
    <div className="script-list--list">
      {Object.values(scripts ?? []).map((script) => renderScriptListItem(script))}
    </div>
  );
}
