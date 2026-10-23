import {
  selectAllUserscripts,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts/selectors";
import { ScriptListItem } from "@/shared/components/script-list-item/ScriptListItem";
import type { ScriptSiteGroup } from "@/shared/utils/script-site";
import { Userscript } from "@shared/model";
import { useSelector } from "react-redux";

type ScriptListProps = {
  scripts?: Userscript[];
  groups?: ScriptSiteGroup[];
  onScriptSelected?: (scriptId: string) => void;
  emptyMessage?: string;
};

export function ScriptList({
  scripts,
  groups,
  onScriptSelected,
  emptyMessage,
}: ScriptListProps) {
  // useSelector (untyped) so this list also works under the popup store.
  const currentScript = useSelector(selectCurrentUserscript);
  const reduxScripts = useSelector(selectAllUserscripts);

  const displayGroups: ScriptSiteGroup[] = groups ?? [
    { site: "", scripts: scripts ?? Object.values(reduxScripts ?? {}) },
  ];
  const isEmpty = displayGroups.every((group) => group.scripts.length === 0);

  const renderItem = (script: Userscript) => (
    <ScriptListItem
      key={script.id}
      script={script}
      active={onScriptSelected ? currentScript?.id === script.id : false}
      onScriptSelected={onScriptSelected}
    />
  );

  return (
    <div className="flex scrollbar-thin-6 flex-1 flex-col overflow-y-auto pb-sm">
      {isEmpty && emptyMessage && (
        <p className="px-md py-lg text-center text-base text-text-muted">
          {emptyMessage}
        </p>
      )}
      {displayGroups.map((group) =>
        group.site ? (
          <section key={group.site} aria-label={group.site}>
            <h3 className="truncate px-md pt-md pb-1 text-xs font-medium text-text-muted-strong">
              {group.site}
            </h3>
            {group.scripts.map(renderItem)}
          </section>
        ) : (
          <div key="all" className="pt-xs">
            {group.scripts.map(renderItem)}
          </div>
        )
      )}
    </div>
  );
}
