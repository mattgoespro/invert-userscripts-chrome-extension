import {
  getScriptModulePath,
  sanitizeModuleName,
  UserscriptSourceLanguage,
} from "@shared/model";
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
const pendingDisposals = new Set<string>();

function isModelAttached(model: monaco.editor.ITextModel): boolean {
  const maybeAttachedModel = model as monaco.editor.ITextModel & {
    isAttachedToEditor?: () => boolean;
  };

  return (
    typeof maybeAttachedModel.isAttachedToEditor === "function" &&
    maybeAttachedModel.isAttachedToEditor()
  );
}

function disposeModelWhenDetached(uri: string): void {
  if (pendingDisposals.has(uri)) {
    return;
  }

  pendingDisposals.add(uri);
  globalThis.setTimeout(() => {
    pendingDisposals.delete(uri);
    disposeModel(uri);
  }, 0);
}

export function disposeModel(uri: string): void {
  const model =
    modelCache.get(uri) ?? monaco.editor.getModel(monaco.Uri.parse(uri));

  if (model && !model.isDisposed()) {
    if (isModelAttached(model)) {
      disposeModelWhenDetached(uri);
      return;
    }

    model.dispose();
  }

  modelCache.delete(uri);
}

export type ScriptEditorKind = "main" | "types" | "styles";

export function buildScriptModelId(
  script: { id: string; moduleName?: string },
  editor: ScriptEditorKind
): string {
  const modulePath = getScriptModulePath(script);

  if (editor === "types") {
    return `scripts/${modulePath}/types.d`;
  }

  return `scripts/${modulePath}/${editor}`;
}

export function disposeModelsForScript(
  script: { id: string; moduleName?: string } | string
): void {
  const markers =
    typeof script === "string"
      ? [script]
      : [script.id, getScriptModulePath(script)];

  for (const [uri] of modelCache) {
    if (
      markers.some(
        (marker) =>
          uri.includes(`scripts/${marker}/`) ||
          uri.includes(`/${marker}.`) ||
          uri.includes(`/${marker}/`)
      )
    ) {
      disposeModel(uri);
    }
  }
}

/**
 * URIs of TypeScript source models that must be kept out of the Monaco
 * TypeScript program while a dependent script is being edited.
 */
const suppressedModelUris = new Set<string>();
let suppressionListener: monaco.IDisposable | undefined;

export function setSuppressedModelUris(uris: string[]): void {
  suppressedModelUris.clear();

  for (const uri of uris) {
    suppressedModelUris.add(uri);
  }

  for (const uri of suppressedModelUris) {
    disposeModel(uri);
  }

  if (suppressedModelUris.size === 0) {
    suppressionListener?.dispose();
    suppressionListener = undefined;
    return;
  }

  if (!suppressionListener) {
    suppressionListener = monaco.editor.onDidCreateModel((model) => {
      if (suppressedModelUris.has(model.uri.toString())) {
        disposeModel(model.uri.toString());
      }
    });
  }
}

export function buildModelUri(
  modelId: string,
  language: UserscriptSourceLanguage
): string {
  const ext = LANGUAGE_EXTENSIONS[language] ?? language;
  return `file:///${modelId}.${ext}`;
}

export function buildScriptTypeSlug(name: string, id: string): string {
  const slug = sanitizeModuleName(name) || "script";
  return `${slug}-${id.slice(0, 8)}`;
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

  if (existing?.isDisposed()) {
    modelCache.delete(uri);
  }

  const model = monaco.editor.createModel(
    contents,
    language,
    monaco.Uri.parse(uri)
  );
  modelCache.set(uri, model);
  return model;
}

/**
 * Returns a live model for the given URI, recreating it when the cache entry or
 * a suppression listener disposed the previous instance.
 */
export function resolveLiveModel(
  uri: string,
  language: UserscriptSourceLanguage,
  contents: string
): monaco.editor.ITextModel {
  let model = getOrCreateModel(uri, language, contents);

  if (!model.isDisposed()) {
    return model;
  }

  modelCache.delete(uri);
  model = getOrCreateModel(uri, language, contents);
  return model;
}

export function attachEditorModel(
  editor: monaco.editor.IStandaloneCodeEditor,
  uri: string,
  language: UserscriptSourceLanguage,
  contents: string
): monaco.editor.ITextModel {
  suppressedModelUris.delete(uri);

  const model = resolveLiveModel(uri, language, contents);
  const currentModel = editor.getModel();

  if (currentModel !== model) {
    editor.setModel(model);
  }

  return model;
}

export function syncModelContents(
  uri: string,
  contents: string,
  language: UserscriptSourceLanguage
): void {
  const model = getOrCreateModel(uri, language, contents);

  if (model.getValue() !== contents) {
    model.setValue(contents);
  }
}
