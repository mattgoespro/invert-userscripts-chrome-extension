import { useAppSelector } from "@/shared/store/hooks";
import {
  selectAllUserscripts,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { ScriptListItem } from "./script-list-item/ScriptListItem";
import "./ScriptList.scss";

export function ScriptList() {
  const currentScript = useAppSelector(selectCurrentUserscript);
  const scripts = useAppSelector(selectAllUserscripts);

  return (
    <div className="script-list--list">
      {Object.values(scripts ?? []).map((script) => (
        <ScriptListItem key={script.id} script={script} active={currentScript?.id === script.id} />
      ))}
    </div>
  );
}
