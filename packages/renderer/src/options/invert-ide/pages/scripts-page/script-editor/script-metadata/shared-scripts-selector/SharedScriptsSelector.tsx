import "./SharedScriptsSelector.scss";
import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { Typography } from "@/shared/components/typography/Typography";
import { Userscript } from "@shared/model";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSharedUserscripts } from "@/shared/store/slices/userscripts.slice";
import { PackageIcon } from "lucide-react";

type SharedScriptsSelectorProps = {
  script: Userscript;
  onToggleSharedScript: (sharedScriptId: string, selected: boolean) => void;
};

export function SharedScriptsSelector({
  script,
  onToggleSharedScript,
}: SharedScriptsSelectorProps) {
  const sharedScripts = useAppSelector(selectSharedUserscripts);

  // Filter out the current script from the list (a script can't import itself)
  const availableSharedScripts = sharedScripts.filter((s) => s.id !== script.id);

  if (availableSharedScripts.length === 0) {
    return (
      <div className="shared-scripts-selector--wrapper shared-scripts-selector--empty">
        <div className="shared-scripts-selector--empty-state">
          <PackageIcon size={14} className="shared-scripts-selector--empty-icon" />
          <Typography variant="caption" className="shared-scripts-selector--empty-text">
            No shared scripts available
          </Typography>
        </div>
      </div>
    );
  }

  const selectedIds = new Set(script.sharedScripts ?? []);

  return (
    <div className="shared-scripts-selector--wrapper">
      <div className="shared-scripts-selector--header">
        <PackageIcon size={13} className="shared-scripts-selector--header-icon" />
        <span className="shared-scripts-selector--header-label">imports</span>
      </div>
      <div className="shared-scripts-selector--list">
        {availableSharedScripts.map((shared) => (
          <div key={shared.id} className="shared-scripts-selector--item">
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
