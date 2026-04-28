import { UserscriptSourceLanguage } from "@shared/model";
import * as monaco from "monaco-editor";

/**
 * Map source language identifiers to file extensions recognised by
 * the Monaco TypeScript worker's module resolution.
 */
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  typescript: "ts",
  scss: "scss",
};

/** Cache models by URI to preserve undo history and cursor position. */
const modelCache = new Map<string, monaco.editor.ITextModel>();

/** Preserve transient editable contents for models that should not stay mounted. */
const disposedModelValueCache = new Map<string, string>();

export function disposeModel(
  uri: string,
  options?: { preserveValue?: boolean }
): void {
  const model = modelCache.get(uri);

  if (model && !model.isDisposed()) {
    if (options?.preserveValue) {
      disposedModelValueCache.set(uri, model.getValue());
    }

    model.dispose();
  }

  modelCache.delete(uri);
}

export function disposeModelsForScript(scriptId: string): void {
  for (const [uri] of modelCache) {
    if (uri.includes(scriptId)) {
      disposeModel(uri);
    }
  }
}

export function buildModelUri(
  modelId: string,
  language: UserscriptSourceLanguage
): string {
  const ext = LANGUAGE_EXTENSIONS[language] ?? language;
  return `file:///${modelId}.${ext}`;
}

export function getOrCreateModel(
  uri: string,
  language: UserscriptSourceLanguage,
  contents: string
): monaco.editor.ITextModel {
  const existing = modelCache.get(uri);
  if (existing && !existing.isDisposed()) {
    return existing;
  }

  const initialContents = disposedModelValueCache.get(uri) ?? contents;
  disposedModelValueCache.delete(uri);

  const model = monaco.editor.createModel(
    initialContents,
    language,
    monaco.Uri.parse(uri)
  );
  modelCache.set(uri, model);
  return model;
}
