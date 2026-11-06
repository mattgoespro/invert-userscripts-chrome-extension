import { useCallback, useEffect, useMemo } from "react";
import { Userscript } from "@shared/model";
import { useAppDispatch } from "@/shared/store/hooks";
import { useToast } from "@/shared/components/toast/ToastProvider";
import {
  createKeyedDebouncer,
  rebaseListUpdates,
  toggleListItem,
  type MetadataUpdates,
} from "@/shared/services/metadata-edits";
import {
  deleteUserscript,
  updateUserscript,
} from "@/shared/store/slices/userscripts/thunks.userscripts";

const MODULE_NAME_DEBOUNCE_MS = 400;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }

  return "Failed to update script metadata.";
}

export interface ScriptMetadataActions {
  updateScript: (updates: Partial<Userscript>) => Promise<void>;
  updateModuleName: (value: string) => void;
  toggleModule: (moduleId: string, selected: boolean) => void;
  deleteScript: () => void;
}

/** Durable metadata edits for one script, shared by the header and details panel. */
export function useScriptMetadataActions(
  script: Userscript | undefined
): ScriptMetadataActions {
  const scriptId = script?.id ?? "";
  const scriptName = script?.name ?? "";
  const scriptModules = script?.globalModules;
  const scriptUrlPatterns = script?.urlPatterns;
  const dispatch = useAppDispatch();
  const { toast } = useToast();

  const publish = useCallback(
    async (id: string, updates: MetadataUpdates) => {
      try {
        await dispatch(updateUserscript({ id, updates })).unwrap();
      } catch (error) {
        toast({
          variant: "error",
          message: getErrorMessage(error),
        });
      }
    },
    [dispatch, toast]
  );

  const moduleNameDebouncer = useMemo(
    () =>
      createKeyedDebouncer<string>((id, value) => {
        void publish(id, {
          moduleName: value,
          shared: value.trim().length > 0,
        });
      }, MODULE_NAME_DEBOUNCE_MS),
    [publish]
  );

  useEffect(() => () => moduleNameDebouncer.flush(), [moduleNameDebouncer]);

  // Callers compute whole lists from what they rendered, which can lag behind
  // edits still publishing. Rebasing applies only what this edit changed.
  const updateScript = useCallback(
    (updates: Partial<Userscript>) =>
      publish(
        scriptId,
        rebaseListUpdates(
          { urlPatterns: scriptUrlPatterns, globalModules: scriptModules },
          updates
        )
      ),
    [publish, scriptId, scriptModules, scriptUrlPatterns]
  );

  const updateModuleName = useCallback(
    (value: string) => moduleNameDebouncer.schedule(scriptId, value),
    [moduleNameDebouncer, scriptId]
  );

  const toggleModule = useCallback(
    (moduleId: string, selected: boolean) => {
      void publish(scriptId, (latest) => ({
        globalModules: toggleListItem(
          latest.globalModules ?? [],
          moduleId,
          selected
        ),
      }));
    },
    [publish, scriptId]
  );

  const deleteScript = useCallback(() => {
    if (!confirm(`Delete “${scriptName}”? This can’t be undone.`)) {
      return;
    }

    moduleNameDebouncer.cancel(scriptId);
    dispatch(deleteUserscript(scriptId));
  }, [dispatch, moduleNameDebouncer, scriptId, scriptName]);

  return { updateScript, updateModuleName, toggleModule, deleteScript };
}
