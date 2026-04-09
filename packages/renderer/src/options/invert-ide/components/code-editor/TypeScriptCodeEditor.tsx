import { useAppSelector } from "@/shared/store/hooks";
import { selectSharedScriptsForUserscript } from "@/shared/store/slices/monaco-editor";
import {
  ensureTypescriptDefaults,
  syncSharedScriptLibs,
} from "@packages/monaco";
import { useEffect, useMemo } from "react";
import { CodeEditor, CodeEditorProps } from "../../shared/CodeEditor";

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

  // Configure the TypeScript language service defaults once, then sync shared
  // script type declarations whenever the dependency list changes.
  useEffect(() => {
    ensureTypescriptDefaults();

    if (sharedScripts) {
      syncSharedScriptLibs(sharedScripts);
    }
  }, [sharedScripts]);

  return <CodeEditor {...rest} scriptId={scriptId} language="typescript" />;
}
