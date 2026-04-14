import { Input } from "@/shared/components/input/Input";
import { Userscript } from "@shared/model";
import { useAppDispatch } from "@/shared/store/hooks";
import { AppDispatch } from "@/shared/store/store";
import { ModuleImportsSelector } from "./module-imports-selector/ModuleImportsSelector";
import {
  deleteUserscript,
  updateUserscript,
} from "@/shared/store/slices/userscripts/thunks.userscripts";
import { OptionsPanel } from "./options-panel/OptionsPanel";

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
    <div className="flex w-full flex-col gap-sm">
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
        <div className="script-metadata--url-patterns relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 z-1 -translate-y-1/2 font-mono text-xs text-syntax-param">
            urls:
          </span>
          <Input
            className="w-full"
            defaultValue={script.urlPatterns?.join(", ")}
            placeholder="URL Patterns (comma separated)..."
            onChange={(event) =>
              onUpdateScriptMeta({
                urlPatterns: event.target.value.split(",").map((p) => p.trim()),
              })
            }
          />
        </div>
        <OptionsPanel
          shared={script.shared ?? false}
          scriptName={script.name}
          moduleName={script.moduleName ?? ""}
          selectedModuleIds={script.globalModules ?? []}
          onModuleNameChange={onModuleNameChange}
          onToggleModule={onToggleModule}
          onDelete={onDeleteScript}
        />
      </div>
      <div className="flex w-full items-center">
        <ModuleImportsSelector
          script={script}
          onToggleSharedScript={onToggleSharedScript}
        />
      </div>
    </div>
  );
}
