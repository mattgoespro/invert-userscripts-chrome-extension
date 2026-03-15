import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSharedUserscripts } from "@/shared/store/slices/userscripts";
import { Userscript } from "@shared/model";
import { PackageIcon } from "lucide-react";
import "./ModuleImportsSelector.scss";

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
      <div className="module-imports-selector--wrapper module-imports-selector--empty">
        <div className="module-imports-selector--empty-state">
          <PackageIcon
            size={14}
            className="module-imports-selector--empty-icon"
          />
          <Typography
            variant="caption"
            className="module-imports-selector--empty-text"
          >
            No shared scripts available
          </Typography>
        </div>
      </div>
    );
  }

  const selectedIds = new Set(script.sharedScripts ?? []);

  return (
    <div className="module-imports-selector--wrapper">
      <div className="module-imports-selector--header">
        <PackageIcon
          size={13}
          className="module-imports-selector--header-icon"
        />
        <span className="module-imports-selector--header-label">imports</span>
      </div>
      <div className="module-imports-selector--list">
        {availableSharedScripts.map((shared) => (
          <div key={shared.id} className="module-imports-selector--item">
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
