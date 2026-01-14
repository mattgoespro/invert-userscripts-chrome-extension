import { useAppSelector } from "@/shared/store/hooks";
import "./ScriptList.scss";
import { selectCurrentUserscript } from "@/shared/store/slices/userscripts.slice";

import { ScriptListItem } from "./script-list-item/ScriptListItem";

export function ScriptList() {
  const currentScript = useAppSelector(selectCurrentUserscript);
  const scripts = useAppSelector((state) => state.userscripts.scripts);

  return (
    <div className="script-list--list">
      {Object.values(scripts ?? []).map((script) => (
        <ScriptListItem key={script.id} script={script} active={currentScript?.id === script.id} />
      ))}
    </div>
  );
}
