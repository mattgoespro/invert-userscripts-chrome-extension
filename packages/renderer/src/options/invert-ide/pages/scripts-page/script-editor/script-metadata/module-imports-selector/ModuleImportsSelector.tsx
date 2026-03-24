import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSharedUserscripts } from "@/shared/store/slices/userscripts";
import { Userscript } from "@shared/model";
import { PackageIcon } from "lucide-react";

type SharedScriptsSelectorProps = {
  script: Userscript;
  onToggleSharedScript: (sharedScriptId: string, selected: boolean) => void;
};

export function ModuleImportsSelector({
  script,
  onToggleSharedScript,
}: SharedScriptsSelectorProps) {
  const sharedScripts = useAppSelector(selectSharedUserscripts);

  // Filter out the current script from the list (a script can't import itself)
  const availableSharedScripts = sharedScripts.filter(
    (s) => s.id !== script.id
  );

  if (availableSharedScripts.length === 0) {
    return (
      <div className="bg-surface-overlay border-border rounded-default relative flex items-center gap-3 border border-dashed px-4 opacity-60">
        <div className="flex items-center gap-1.5">
          <PackageIcon size={14} className="text-text-muted" />
          <Typography
            variant="caption"
            className="text-text-muted font-mono text-[11px] italic"
          >
            No shared scripts available
          </Typography>
        </div>
      </div>
    );
  }

  const selectedIds = new Set(script.sharedScripts ?? []);

  return (
    <div className="bg-surface-overlay border-border rounded-default relative flex items-center gap-3 border px-4">
      <div className="flex shrink-0 items-center gap-1.5">
        <PackageIcon size={13} className="text-syntax-keyword opacity-75" />
        <span className="text-syntax-keyword font-mono text-[10px] tracking-[0.01em] select-none">
          imports
        </span>
      </div>
      <div className="gap-sm flex flex-wrap items-center">
        {availableSharedScripts.map((shared) => (
          <div key={shared.id} className="flex items-center">
            <Checkbox
              checked={selectedIds.has(shared.id)}
              onChange={(checked) => onToggleSharedScript(shared.id, checked)}
              label={shared.name}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
