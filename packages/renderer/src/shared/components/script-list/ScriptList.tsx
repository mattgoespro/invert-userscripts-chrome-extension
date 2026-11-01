import {
  selectAllUserscripts,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts/selectors";
import { ScriptListItem } from "@/shared/components/script-list-item/ScriptListItem";
import { Userscript } from "@shared/model";
import { useSelector } from "react-redux";

/** A titled run of scripts, for lists that group scripts by state. */
export type ScriptListSection = {
  title: string;
  scripts: Userscript[];
};

type ScriptListProps = {
  scripts?: Userscript[];
  /** Render titled sections instead of a single list. */
  sections?: ScriptListSection[];
  onScriptSelected?: (scriptId: string) => void;
  emptyMessage?: string;
  /** Show the URL pattern caption under each script name. */
  showCaptions?: boolean;
};

export function ScriptList({
  scripts,
  sections,
  onScriptSelected,
  emptyMessage,
  showCaptions = true,
}: ScriptListProps) {
  // useSelector (untyped) so this list also works under the popup store.
  const currentScript = useSelector(selectCurrentUserscript);
  const reduxScripts = useSelector(selectAllUserscripts);

  const displaySections: ScriptListSection[] = sections ?? [
    { title: "", scripts: scripts ?? Object.values(reduxScripts ?? {}) },
  ];
  const isEmpty = displaySections.every(
    (section) => section.scripts.length === 0
  );

  const renderItem = (script: Userscript) => (
    <ScriptListItem
      key={script.id}
      script={script}
      active={onScriptSelected ? currentScript?.id === script.id : false}
      onScriptSelected={onScriptSelected}
      showCaption={showCaptions}
    />
  );

  return (
    <div className="flex scrollbar-thin-6 flex-1 flex-col overflow-y-auto pt-xs pb-sm">
      {isEmpty && emptyMessage && (
        <p className="px-md py-lg text-center text-base text-text-muted">
          {emptyMessage}
        </p>
      )}
      {displaySections.map((section) =>
        section.title ? (
          <section key={section.title} aria-label={section.title}>
            <h3 className="truncate px-md pt-sm pb-1 text-xs font-medium text-text-muted-strong">
              {section.title}
            </h3>
            {section.scripts.map(renderItem)}
          </section>
        ) : (
          <div key="all">{section.scripts.map(renderItem)}</div>
        )
      )}
    </div>
  );
}
