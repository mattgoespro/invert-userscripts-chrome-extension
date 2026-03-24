import { useToast } from "@/shared/components/toast/ToastProvider";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSharedScriptsForUserscript } from "@/shared/store/slices/monaco-editor";
import {
  ensureTypescriptDefaults,
  syncSharedScriptLibs,
} from "@packages/monaco";
import { useEffect, useMemo } from "react";
import { CodeEditor, CodeEditorProps } from "./CodeEditor";

/**
 * TypeScript-specific wrapper around {@link CodeEditor} that configures Monaco's
 * TypeScript language service defaults, and synchronizes shared script type
 * declarations for module import resolution (intellisense).
 */
export function TypeScriptCodeEditor(props: Omit<CodeEditorProps, "language">) {
  const { scriptId, ...rest } = props;
  const sharedScripts = useAppSelector(
    useMemo(() => selectSharedScriptsForUserscript(scriptId), [scriptId])
  );
  const toast = useToast();

  // Wait for the TypeScript contribution module to load (triggered by the child
  // CodeEditor creating a TS model), configure the language service defaults,
  // then sync shared script type declarations for intellisense.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      await ensureTypescriptDefaults(controller.signal);

      if (controller.signal.aborted) {
        toast.toast({
          variant: "warning",
          message: "Aborted TS defaults setup.",
        });
        return;
      }

      if (sharedScripts) {
        syncSharedScriptLibs(sharedScripts);
      }
    })();

    return () => controller.abort();
  }, [sharedScripts]);

  return <CodeEditor {...rest} scriptId={scriptId} language="typescript" />;
}
