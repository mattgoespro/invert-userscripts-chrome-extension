import { Input } from "@/shared/components/input/Input";
import { Userscript } from "@shared/model";
import { useAppDispatch } from "@/shared/store/hooks";
import { AppDispatch } from "@/shared/store/store";
import {
  deleteUserscript,
  updateUserscript,
} from "@/shared/store/slices/userscripts/thunks.userscripts";
import { OptionsPanel } from "./options-panel/OptionsPanel";
import { UrlPatternInput } from "./url-pattern-input/UrlPatternInput";

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

  const onToggleModule = (moduleId: string, selected: boolean) => {
    const currentModules = script.globalModules ?? [];
    const updatedModules = selected
      ? [...currentModules, moduleId]
      : currentModules.filter((id) => id !== moduleId);
    onUpdateScriptMeta({ globalModules: updatedModules });
  };

  return (
    <div className="flex w-full items-center gap-sm">
      <span className="shrink-0 font-mono text-sm text-syntax-keyword">
        const
      </span>
      <Input
        className="basis-1/4"
        required
        defaultValue={script.name}
        placeholder="Script name..."
        onChange={(event) => onUpdateScriptMeta({ name: event.target.value })}
      />
      <UrlPatternInput
        className="flex-1"
        patterns={script.urlPatterns ?? []}
        onChange={(urlPatterns) => onUpdateScriptMeta({ urlPatterns })}
      />
      <OptionsPanel
        script={script}
        shared={script.shared ?? false}
        scriptName={script.name}
        moduleName={script.moduleName ?? ""}
        selectedModuleIds={script.globalModules ?? []}
        onModuleNameChange={onModuleNameChange}
        onToggleModule={onToggleModule}
        onToggleSharedScript={onToggleSharedScript}
        onDelete={onDeleteScript}
      />
    </div>
  );
}
