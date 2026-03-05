import { useAppSelector } from "@/shared/store/hooks";
import {
  selectAllUserscripts,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { ScriptListItem } from "./script-list-item/ScriptListItem";
import "./ScriptList.scss";

type ScriptListProps = {
  onScriptSelected: (scriptId: string) => void;
};

export function ScriptList({ onScriptSelected }: ScriptListProps) {
  const currentScript = useAppSelector(selectCurrentUserscript);
  const scripts = useAppSelector(selectAllUserscripts);

  return (
    <div className="script-list--list">
      {Object.values(scripts ?? []).map((script) => (
        <ScriptListItem
          key={script.id}
          script={script}
          active={currentScript?.id === script.id}
          onScriptSelected={onScriptSelected}
        />
      ))}
    </div>
  );
}
