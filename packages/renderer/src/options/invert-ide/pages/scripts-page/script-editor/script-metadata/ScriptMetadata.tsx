import { Input } from "@/shared/components/input/Input";
import { Switch } from "@/shared/components/switch/Switch";
import { Userscript } from "@shared/model";
import "./ScriptMetadata.scss";
import { useAppDispatch } from "@/shared/store/hooks";
import { AppDispatch } from "@/shared/store/store";
import { updateUserscript } from "@/shared/store/slices/userscripts.slice";
import { SharedScriptsSelector } from "./shared-scripts-selector/SharedScriptsSelector";

type ScriptMetadataProps = {
  script: Userscript;
};

export function ScriptMetadata({ script }: ScriptMetadataProps) {
  const dispatch: AppDispatch = useAppDispatch();

  const onUpdateScriptMeta = async (updates: Partial<Userscript>) => {
    dispatch(updateUserscript({ ...script, ...updates }));
  };

  const onToggleShared = (checked: boolean) => {
    onUpdateScriptMeta({ shared: checked });
  };

  const onModuleNameChange = (value: string) => {
    onUpdateScriptMeta({ moduleName: value });
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
        {script.shared && (
          <Input
            className="script-metadata--module-name"
            defaultValue={script.moduleName ?? ""}
            placeholder="module-name"
            onChange={(e) => onModuleNameChange(e.target.value)}
          />
        )}
        <Input
          className="script-metadata--url-patterns"
          defaultValue={script.urlPatterns?.join(", ")}
          placeholder="URL Patterns (comma separated)..."
          onChange={(e) =>
            onUpdateScriptMeta({ urlPatterns: e.target.value.split(",").map((p) => p.trim()) })
          }
        />
        <div className="script-metadata--shared-toggle">
          <Switch checked={script.shared ?? false} onChange={onToggleShared} label="shared" />
        </div>
      </div>
      <div className="script-metadata--imports-row">
        <SharedScriptsSelector script={script} onToggleSharedScript={onToggleSharedScript} />
      </div>
    </div>
  );
}
