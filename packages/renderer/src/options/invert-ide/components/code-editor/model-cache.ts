import { sanitizeModuleName, UserscriptSourceLanguage } from "@shared/model";
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
  // Prefer the cached instance; fall back to Monaco's global model registry in
  // case the model was recreated outside getOrCreateModel or was evicted from
  // our cache by a previous disposal.
  const model =
    modelCache.get(uri) ?? monaco.editor.getModel(monaco.Uri.parse(uri));

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

/**
 * URIs of TypeScript source models that must be kept out of the Monaco
 * TypeScript program while a dependent script is being edited.
 *
 * A shared script's editor source model (`scripts/<id>/main.ts`) would
 * otherwise make TypeScript's auto-import generate a relative path to that
 * in-memory model instead of the canonical `shared/<moduleName>` specifier
 * exposed through the registered extra lib.
 */
const suppressedModelUris = new Set<string>();
let suppressionListener: monaco.IDisposable | undefined;

/**
 * Replaces the set of suppressed shared-script source model URIs.
 *
 * Any currently registered model matching the set is disposed immediately, and
 * a single shared listener disposes matching models that are (re-)created while
 * the suppression is active. Passing an empty array clears all suppressions and
 * tears the listener down. Centralizing this here guarantees exactly one global
 * `onDidCreateModel` listener regardless of how many editors mount.
 */
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
        model.dispose();
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

/**
 * Derives a stable, human-readable slug for a script's virtual type declaration
 * path in Monaco's TypeScript virtual filesystem. The slug is composed of a
 * name-derived prefix and the first 8 characters of the script ID to guarantee
 * uniqueness even when two scripts share the same name.
 *
 * Example: name="My Utils", id="a1b2c3d4-..." → "my-utils-a1b2c3d4"
 */
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
