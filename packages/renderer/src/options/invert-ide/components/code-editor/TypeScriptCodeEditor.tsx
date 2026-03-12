import { ensureTypescriptDefaults } from "@packages/monaco";
import { useAppSelector } from "@/shared/store/hooks";
import {
  selectSharedScriptsForUserscript,
  syncSharedScriptLibs,
} from "@/shared/store/slices/monaco-editor";
import { useEffect, useMemo } from "react";
import { CodeEditor, CodeEditorProps } from "./CodeEditor";

/**
 * TypeScript-specific wrapper around CodeEditor that configures the Monaco
 * TypeScript language service defaults and syncs shared script type
 * declarations for module import resolution (intellisense).
 */
export function TypeScriptCodeEditor(props: CodeEditorProps) {
  const { scriptId, ...rest } = props;
  const sharedScripts = useAppSelector(
    useMemo(() => selectSharedScriptsForUserscript(scriptId), [scriptId])
  );

  // Wait for the TypeScript contribution module to load (triggered by the child
  // CodeEditor creating a TS model), configure the language service defaults,
  // then sync shared script type declarations for intellisense.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      console.log("Ensuring TS defaults...");
      await ensureTypescriptDefaults(controller.signal);

      if (controller.signal.aborted) {
        console.log("Aborted TS defaults setup.");
        return;
      }

      console.log("TS defaults configured.");

      if (sharedScripts) {
        syncSharedScriptLibs(sharedScripts);
      } else {
        console.log("No shared scripts to sync.");
      }
    })();

    return () => controller.abort();
  }, [sharedScripts]);

  return <CodeEditor {...rest} scriptId={scriptId} language="typescript" />;
}
