import { GlobalModule } from "@shared/model";
import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  addModule,
  deleteModule,
  selectModules,
  updateModule,
} from "@/shared/store/slices/modules";
import { Button } from "@/shared/components/button/Button";
import { CodeComment } from "@/shared/components/code-comment/CodeComment";
import { CodeLine } from "@/shared/components/code-line/CodeLine";
import { ModuleCard } from "./ModuleCard";
import { AddModuleDialog } from "./add-module-dialog/AddModuleDialog";
import { useState } from "react";

export function ModulesPage() {
  const dispatch = useAppDispatch();
  const modules = useAppSelector(selectModules);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddModule = useCallback(
    async (module: GlobalModule) => {
      await dispatch(addModule(module)).unwrap();
      setDialogOpen(false);
    },
    [dispatch]
  );

  const handleDeleteModule = useCallback(
    async (moduleId: string) => {
      if (confirm("Delete this module?")) {
        await dispatch(deleteModule(moduleId)).unwrap();
      }
    },
    [dispatch]
  );

  const handleToggleModule = useCallback(
    async (module: GlobalModule) => {
      await dispatch(
        updateModule({ ...module, enabled: !module.enabled })
      ).unwrap();
    },
    [dispatch]
  );

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
