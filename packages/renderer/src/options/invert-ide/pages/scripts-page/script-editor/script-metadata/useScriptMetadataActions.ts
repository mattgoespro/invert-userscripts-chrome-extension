import { useCallback, useEffect, useRef } from "react";
import { Userscript } from "@shared/model";
import { useAppDispatch } from "@/shared/store/hooks";
import { useToast } from "@/shared/components/toast/ToastProvider";
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
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  const moduleNameDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (moduleNameDebounceRef.current) {
        clearTimeout(moduleNameDebounceRef.current);
      }
    };
  }, []);

  const updateScript = useCallback(
    async (updates: Partial<Userscript>) => {
      try {
        await dispatch(updateUserscript({ id: scriptId, updates })).unwrap();
      } catch (error) {
        toast({
          variant: "error",
          message: getErrorMessage(error),
        });
      }
    },
    [dispatch, scriptId, toast]
  );

  const updateModuleName = useCallback(
    (value: string) => {
      if (moduleNameDebounceRef.current) {
        clearTimeout(moduleNameDebounceRef.current);
      }

      moduleNameDebounceRef.current = setTimeout(() => {
        const trimmed = value.trim();
        void updateScript({ moduleName: value, shared: trimmed.length > 0 });
      }, MODULE_NAME_DEBOUNCE_MS);
    },
    [updateScript]
  );

  const toggleModule = useCallback(
    (moduleId: string, selected: boolean) => {
      const currentModules = scriptModules ?? [];
      const updatedModules = selected
        ? [...currentModules, moduleId]
        : currentModules.filter((id) => id !== moduleId);
      void updateScript({ globalModules: updatedModules });
    },
    [scriptModules, updateScript]
  );

  const deleteScript = useCallback(() => {
    if (!confirm(`Delete “${scriptName}”? This can’t be undone.`)) {
      return;
    }

    dispatch(deleteUserscript(scriptId));
  }, [dispatch, scriptId, scriptName]);

  return { updateScript, updateModuleName, toggleModule, deleteScript };
}
