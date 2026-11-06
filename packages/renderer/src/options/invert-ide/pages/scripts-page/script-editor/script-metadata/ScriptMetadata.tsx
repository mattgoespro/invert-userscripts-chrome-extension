import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Userscript } from "@shared/model";
import { PanelRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { buildNameUpdates } from "./name-updates";
import type { ScriptMetadataActions } from "./useScriptMetadataActions";

type ScriptMetadataProps = {
  script: Userscript;
  actions: ScriptMetadataActions;
  detailsOpen: boolean;
  onToggleDetails: () => void;
};

export function ScriptMetadata({
  script,
  actions,
  detailsOpen,
  onToggleDetails,
}: ScriptMetadataProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  // The input is uncontrolled so typing isn't overwritten by slower publication
  // results. Renames from elsewhere still have to reach it once it's idle.
  useEffect(() => {
    const input = nameInputRef.current;
    if (input && input !== document.activeElement) {
      input.value = script.name;
    }
  }, [script.name]);

  return (
    <div className="flex w-full min-w-0 items-center gap-sm">
      <input
        ref={nameInputRef}
        className="h-8 min-w-0 flex-1 rounded-default border border-transparent bg-transparent px-1.5 font-heading text-[17px] font-bold tracking-[-0.01em] text-foreground outline-none hover:border-border focus:border-accent-border focus:bg-surface-input"
        required
        defaultValue={script.name}
        placeholder="Script name..."
        aria-label="Script name"
        onChange={(event) => {
          void actions.updateScript(
            buildNameUpdates(script, event.target.value)
          );
        }}
      />
      <IconButton
        icon={PanelRightIcon}
        variant="ghost"
        aria-pressed={detailsOpen}
        aria-haspopup="dialog"
        onClick={onToggleDetails}
        title="Script details"
      />
    </div>
  );
}
