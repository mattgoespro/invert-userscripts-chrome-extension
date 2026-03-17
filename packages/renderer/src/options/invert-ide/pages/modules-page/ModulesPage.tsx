import { GlobalModule, GlobalModules } from "@shared/model";
import { ChromeSyncStorage } from "@shared/storage";
import { useState } from "react";
import { Button } from "@/shared/components/button/Button";
import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { CodeComment } from "@/shared/components/code-comment/CodeComment";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { CodeLine } from "@/shared/components/code-line/CodeLine";
import { Typography } from "@/shared/components/typography/Typography";
import { DeleteIcon } from "lucide-react";

export function ModulesPage() {
  const [modules, setModules] = useState<GlobalModules>({});

  const loadData = async () => {
    const loadedModules = await ChromeSyncStorage.getAllModules();
    setModules(loadedModules);
  };

  const handleCreateModule = async () => {
    const name = prompt("Module name:");
    if (!name) return;

    const url = prompt("CDN URL:");
    if (!url) return;

    const newModule: GlobalModule = {
      id: Date.now().toString(),
      name,
      url,
      enabled: true,
    };

    await ChromeSyncStorage.saveModule(newModule);
    await loadData();
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (confirm("Delete this module?")) {
      await ChromeSyncStorage.deleteModule(moduleId);
      await loadData();
    }
  };

  const handleToggleModule = async (module: GlobalModule) => {
    const updated = { ...module, enabled: !module.enabled };
    await ChromeSyncStorage.saveModule(updated);
    await loadData();
  };

  return (
    <div className="flex-1 p-(--page-padding)">
      <div className="flex justify-between items-center mb-lg pb-sm border-b border-border">
        <CodeLine code="import { Modules } from 'cdn'" />
        <Button onClick={handleCreateModule}>+ Add Module</Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 h-[calc(100%-4rem)]">
        {Object.values(modules ?? {}).map((module) => (
          <div
            key={module.id}
            className="bg-surface-raised border border-border rounded-default p-md flex flex-col gap-md transition-colors duration-150 hover:border-accent-muted"
          >
            <div className="flex-1">
              <Typography
                variant="code"
                className="block text-[15px] text-syntax-type mb-sm"
              >
                {module.name}
              </Typography>
              <div className="font-mono text-xs text-text-muted break-all p-sm px-md bg-surface-overlay rounded-default border border-border-subtle">
                {module.url}
              </div>
            </div>
            <div className="flex justify-between items-center pt-sm border-t border-border-subtle">
              <Checkbox
                label="Enabled"
                checked={module.enabled}
                onChange={() => handleToggleModule(module)}
              />
              <IconButton
                icon={DeleteIcon}
                variant="danger"
                onClick={() => handleDeleteModule(module.id)}
              >
                <DeleteIcon />
              </IconButton>
            </div>
          </div>
        ))}
        {Object.values(modules ?? {}).length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center text-center">
            <CodeComment>No modules imported yet.</CodeComment>
          </div>
        )}
      </div>
    </div>
  );
}
