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

export function disposeModel(uri: string): void {
  const model = modelCache.get(uri);

  if (model && !model.isDisposed()) {
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

  const model = monaco.editor.createModel(
    contents,
    language,
    monaco.Uri.parse(uri)
  );
  modelCache.set(uri, model);
  return model;
}
