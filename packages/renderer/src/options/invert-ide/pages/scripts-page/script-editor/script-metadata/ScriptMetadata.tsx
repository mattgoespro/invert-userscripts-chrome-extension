import { IconButton } from "@/shared/components/icon-button/IconButton";
import { sanitizeModuleName, Userscript } from "@shared/model";
import { PanelRightIcon } from "lucide-react";
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
  return (
    <div className="flex w-full min-w-0 items-center gap-sm">
      <input
        className="h-8 min-w-0 flex-1 rounded-default border border-transparent bg-transparent px-1.5 font-heading text-[17px] font-bold tracking-[-0.01em] text-foreground outline-none hover:border-border focus:border-accent-border focus:bg-surface-input"
        required
        defaultValue={script.name}
        placeholder="Script name..."
        aria-label="Script name"
        onChange={(event) => {
          const newName = event.target.value;
          const updates: Partial<Userscript> = { name: newName };
          if (script.moduleName === sanitizeModuleName(script.name)) {
            const sanitized = sanitizeModuleName(newName);
            updates.moduleName = sanitized;
            updates.shared = sanitized.length > 0;
          }
          void actions.updateScript(updates);
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
