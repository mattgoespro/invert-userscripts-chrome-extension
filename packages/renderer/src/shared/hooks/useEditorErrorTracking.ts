import { useEffect } from "react";
import * as monaco from "monaco-editor";
import { useAppDispatch } from "@/shared/store/hooks";
import { setScriptErrors } from "@/shared/store/slices/workspace";
import { CompilationError } from "@shared/errors";
import { v4 as uuid } from "uuid";

/**
 * Hook that captures Monaco editor errors and syncs them to Redux store
 */
export function useEditorErrorTracking(
  scriptId: string | undefined,
  model: monaco.editor.ITextModel | null,
  language: CompilationError["language"]
) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!scriptId || !model) {
      return;
    }

    // Initial error check
    const updateErrors = () => {
      const markers = monaco.editor.getModelMarkers({ resource: model.uri });
      const errors: CompilationError[] = markers.map((marker) => ({
        id: uuid(),
        scriptId,
        language,
        message: marker.message,
        code:
          typeof marker.code === "string"
            ? marker.code
            : marker.code?.value?.toString(),
        severity:
          marker.severity === monaco.MarkerSeverity.Error ? "error" : "warning",
        line: marker.startLineNumber,
        column: marker.startColumn,
        endLine: marker.endLineNumber,
        endColumn: marker.endColumn,
        timestamp: Date.now(),
      }));

      dispatch(setScriptErrors({ scriptId, language, errors }));
    };

    // Update errors initially
    updateErrors();

    // Listen for marker changes
    const disposable = monaco.editor.onDidChangeMarkers((uris) => {
      if (uris.some((uri) => uri.toString() === model.uri.toString())) {
        updateErrors();
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [scriptId, model, language, dispatch]);
}
