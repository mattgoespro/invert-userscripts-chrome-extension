import { useAppSelector } from "@/shared/store/hooks";
import {
  selectAllUserscripts,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts";
import { ScriptListItem } from "./script-list-item/ScriptListItem";

type ScriptListProps = {
  onScriptSelected: (scriptId: string) => void;
};

export function ScriptList({ onScriptSelected }: ScriptListProps) {
  const currentScript = useAppSelector(selectCurrentUserscript);
  const scripts = useAppSelector(selectAllUserscripts);

  return (
    <div className="scrollbar-thin-6 flex-1 overflow-y-auto p-2">
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
