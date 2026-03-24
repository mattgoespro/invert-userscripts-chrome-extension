import { GlobalModule, GlobalModules } from "@shared/model";
import { ChromeSyncStorage } from "@shared/storage";
import { useState } from "react";
import { Button } from "@/shared/components/button/Button";
import { CodeComment } from "@/shared/components/code-comment/CodeComment";
import { CodeLine } from "@/shared/components/code-line/CodeLine";
import { ModuleCard } from "./ModuleCard";

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
      <div className="mb-lg pb-sm border-border flex items-center justify-between border-b">
        <CodeLine code="import { Modules } from 'cdn'" />
        <Button onClick={handleCreateModule}>+ Add Module</Button>
      </div>
      <div className="grid h-[calc(100%-4rem)] grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
        {Object.values(modules ?? {}).map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            onToggle={() => handleToggleModule(module)}
            onDelete={() => handleDeleteModule(module.id)}
          />
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
