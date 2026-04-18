import { useAppSelector } from "@/shared/store/hooks";
import {
  selectAllUserscripts,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts";
import { ScriptListItem } from "@/shared/components/script-list-item/ScriptListItem";
import { Userscript } from "@shared/model";

type ScriptListProps = {
  scripts?: Userscript[];
  onScriptSelected?: (scriptId: string) => void;
};

export function ScriptList({ scripts, onScriptSelected }: ScriptListProps) {
  const currentScript = useAppSelector(selectCurrentUserscript);
  const reduxScripts = useAppSelector(selectAllUserscripts);

  const displayScripts = scripts ?? Object.values(reduxScripts ?? {});

  return (
    <div className="scrollbar-thin-6 flex-1 overflow-y-auto p-2">
      {displayScripts.map((script) => (
        <ScriptListItem
          key={script.id}
          script={script}
          active={onScriptSelected ? currentScript?.id === script.id : false}
          onScriptSelected={onScriptSelected}
        />
      ))}
    </div>
  );
}
