import { GlobalModule, GlobalModules } from "@shared/model";
import { ChromeSyncStorage } from "@shared/storage";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components/button/Button";
import { CodeComment } from "@/shared/components/code-comment/CodeComment";
import { CodeLine } from "@/shared/components/code-line/CodeLine";
import { ModuleCard } from "./ModuleCard";
import { AddModuleDialog } from "./add-module-dialog/AddModuleDialog";

export function ModulesPage() {
  const [modules, setModules] = useState<GlobalModules>({});
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    const loadedModules = await ChromeSyncStorage.getAllModules();
    setModules(loadedModules);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddModule = async (module: GlobalModule) => {
    await ChromeSyncStorage.saveModule(module);
    await loadData();
    setDialogOpen(false);
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
      <div className="mb-lg flex items-center justify-between border-b border-border pb-sm">
        <CodeLine code="import { Modules } from 'cdn'" />
        <Button onClick={() => setDialogOpen(true)}>+ Add Module</Button>
      </div>
      <div className="flex h-[calc(100%-4rem)] flex-col gap-4">
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
      <AddModuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAddModule}
      />
    </div>
  );
}
