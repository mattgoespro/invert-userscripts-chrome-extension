import { GlobalModule } from "@shared/model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  addModule,
  deleteModule,
  selectModules,
  updateModule,
} from "@/shared/store/slices/modules";
import { Button } from "@/shared/components/button/Button";
import { Typography } from "@/shared/components/typography/Typography";
import {
  selectAllUserscripts,
  selectSharedUserscripts,
} from "@/shared/store/slices/userscripts";
import { ModuleCard, TypesValidationStatus } from "./ModuleCard";
import { AddModuleDialog } from "./add-module-dialog/AddModuleDialog";
import { validateTypesUrl } from "./validate-module";
import { LoaderCircleIcon } from "lucide-react";

type TypesValidationMap = Record<string, TypesValidationStatus>;

export function ModulesPage() {
  const dispatch = useAppDispatch();
  const modules = useAppSelector(selectModules);
  const scripts = useAppSelector(selectAllUserscripts);
  const sharedScripts = useAppSelector(selectSharedUserscripts);
  const usageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const script of Object.values(scripts ?? {})) {
      for (const moduleId of script.globalModules ?? []) {
        counts[moduleId] = (counts[moduleId] ?? 0) + 1;
      }
    }
    return counts;
  }, [scripts]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typesValidation, setTypesValidation] = useState<TypesValidationMap>(
    {}
  );
  const [checkingTypes, setCheckingTypes] = useState(false);
  const validationGenerationRef = useRef(0);

  const moduleList = useMemo(() => Object.values(modules ?? {}), [modules]);

  const typedModules = useMemo(
    () => moduleList.filter((module) => module.packageName),
    [moduleList]
  );

  const typedModulesFingerprint = useMemo(
    () =>
      typedModules
        .map(
          (module) =>
            `${module.id}:${module.packageName}:${module.typeVersion ?? "latest"}`
        )
        .sort()
        .join("|"),
    [typedModules]
  );

  const runTypesValidation = useCallback(async (targets: GlobalModule[]) => {
    const withTypes = targets.filter(
      (module): module is GlobalModule & { packageName: string } =>
        !!module.packageName
    );

    if (withTypes.length === 0) {
      setTypesValidation({});
      setCheckingTypes(false);
      return;
    }

    const generation = ++validationGenerationRef.current;
    setCheckingTypes(true);
    setTypesValidation(
      Object.fromEntries(
        withTypes.map((module) => [module.id, { status: "checking" as const }])
      )
    );

    const results = await Promise.all(
      withTypes.map(async (module) => {
        const error = await validateTypesUrl(
          module.packageName,
          module.typeVersion
        );
        return {
          id: module.id,
          status: (error
            ? { status: "error" as const, error }
            : { status: "ok" as const }) satisfies TypesValidationStatus,
        };
      })
    );

    if (generation !== validationGenerationRef.current) {
      return;
    }

    setTypesValidation(
      Object.fromEntries(results.map(({ id, status }) => [id, status]))
    );
    setCheckingTypes(false);
  }, []);

  useEffect(() => {
    runTypesValidation(moduleList);
    // Only re-check when typed packageNames change (not enable/disable).
  }, [runTypesValidation, typedModulesFingerprint]);

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
    <div className="scrollbar-thin-6 min-w-0 flex-1 overflow-y-auto p-(--page-padding)">
      <div className="max-w-6xl mx-auto flex flex-col gap-xl">
        <div className="flex flex-wrap items-end justify-between gap-md">
          <div className="flex flex-col gap-1">
            <Typography variant="subtitle">Modules</Typography>
            <Typography variant="body">
              CDN libraries your scripts can load, and the shared scripts they
              can import.
            </Typography>
          </div>
          <div className="flex items-center gap-2">
            {typedModules.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => void runTypesValidation(moduleList)}
                disabled={checkingTypes}
              >
                {checkingTypes && (
                  <LoaderCircleIcon size={14} className="animate-spin" />
                )}
                {checkingTypes ? "Checking types…" : "Re-check types"}
              </Button>
            )}
            <Button onClick={() => setDialogOpen(true)}>Add module</Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-panel border border-border bg-surface-raised">
          <table className="w-full table-fixed border-collapse text-left text-base">
            <thead>
              <tr className="bg-surface-panel text-xs text-text-muted-strong">
                <th scope="col" className="w-14 px-md py-2 font-medium">
                  On
                </th>
                <th scope="col" className="w-[18%] px-md py-2 font-medium">
                  Module
                </th>
                <th scope="col" className="px-md py-2 font-medium">
                  Source
                </th>
                <th scope="col" className="w-[22%] px-md py-2 font-medium">
                  Types
                </th>
                <th scope="col" className="w-28 px-md py-2 font-medium">
                  Used by
                </th>
                <th scope="col" className="w-12 px-md py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {moduleList.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  usedBy={usageCounts[module.id] ?? 0}
                  typesValidation={
                    module.packageName ? typesValidation[module.id] : undefined
                  }
                  onToggle={() => handleToggleModule(module)}
                  onDelete={() => handleDeleteModule(module.id)}
                />
              ))}
            </tbody>
          </table>
          {moduleList.length === 0 && (
            <div className="flex flex-col items-center gap-sm px-lg py-2xl text-center">
              <Typography variant="body">
                No modules yet. Add a library from a CDN URL to load it before
                your scripts run.
              </Typography>
              <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                Add your first module
              </Button>
            </div>
          )}
        </div>
        <section className="flex flex-col gap-sm">
          <Typography variant="section-title">Shared scripts</Typography>
          {sharedScripts.length === 0 ? (
            <Typography variant="body">
              None yet. Give a script a module name in its details panel to
              share it.
            </Typography>
          ) : (
            <div className="overflow-hidden rounded-panel border border-border bg-surface-raised">
              {sharedScripts.map((script) => (
                <div
                  key={script.id}
                  className="flex items-center gap-md border-b border-border-subtle px-md py-2 last:border-b-0"
                >
                  <span className="w-[18%] min-w-0 truncate text-foreground">
                    {script.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
                    import … from &quot;scripts/{script.moduleName}/main&quot;
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <AddModuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAddModule}
      />
    </div>
  );
}
