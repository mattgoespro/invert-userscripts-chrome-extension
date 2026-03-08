import { Input } from "@/shared/components/input/Input";
import { Userscript } from "@shared/model";
import "./ScriptMetadata.scss";
import { useAppDispatch } from "@/shared/store/hooks";
import { AppDispatch } from "@/shared/store/store";
import {
  deleteUserscript,
  updateUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { SharedScriptsSelector } from "./shared-scripts-selector/SharedScriptsSelector";
import { ScriptOptionsPanel } from "./script-options-panel/ScriptOptionsPanel";
import { FileSizeIndicator } from "./file-size-indicator/FileSizeIndicator";

type ScriptMetadataProps = {
  script: Userscript;
};

export function ScriptMetadata({ script }: ScriptMetadataProps) {
  const dispatch: AppDispatch = useAppDispatch();

  const onUpdateScriptMeta = async (updates: Partial<Userscript>) => {
    dispatch(updateUserscript({ ...script, ...updates }));
  };

  const onModuleNameChange = (value: string) => {
    const trimmed = value.trim();
    onUpdateScriptMeta({ moduleName: value, shared: trimmed.length > 0 });
  };

  const onDeleteScript = () => {
    if (!confirm("Are you sure you want to delete this script?")) {
      return;
    }
    dispatch(deleteUserscript(script.id));
  };

  const onToggleSharedScript = (sharedScriptId: string, selected: boolean) => {
    const currentShared = script.sharedScripts ?? [];
    const updatedShared = selected
      ? [...currentShared, sharedScriptId]
      : currentShared.filter((id) => id !== sharedScriptId);
    onUpdateScriptMeta({ sharedScripts: updatedShared });
  };

  return (
    <div className="script-metadata--wrapper">
      <div className="script-metadata--top-row">
        <Input
          className="script-metadata--name"
          defaultValue={script.name}
          placeholder="Script name..."
          onChange={(e) => onUpdateScriptMeta({ name: e.target.value })}
        />
        <Input
          className="script-metadata--url-patterns"
          defaultValue={script.urlPatterns?.join(", ")}
          placeholder="URL Patterns (comma separated)..."
          onChange={(e) =>
            onUpdateScriptMeta({
              urlPatterns: e.target.value.split(",").map((p) => p.trim()),
            })
          }
        />
        <FileSizeIndicator script={script} />
        <ScriptOptionsPanel
          shared={script.shared ?? false}
          scriptName={script.name}
          moduleName={script.moduleName ?? ""}
          onModuleNameChange={onModuleNameChange}
          onDelete={onDeleteScript}
        />
      </div>
      <div className="script-metadata--imports-row">
        <SharedScriptsSelector
          script={script}
          onToggleSharedScript={onToggleSharedScript}
        />
      </div>
    </div>
  );
}
