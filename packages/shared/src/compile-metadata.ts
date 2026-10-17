import {
  getScriptModulePath,
  type CompiledCodeBuildMetadata,
  type CompiledCodeEntry,
  type EditorSettings,
} from "./model";
import { sha256 } from "./storage/sync/revision-codec";

export interface CompiledOutputBuildOptions {
  compilerContractVersion?: number;
  sourceDigest?: string;
  minifyCompiledOutput: boolean;
  sourceHash?: string;
}
export function digestUserscriptCompileSources(
  script: UserscriptCompileSnapshot
): Promise<string> {
  return sha256(
    JSON.stringify([
      script.code.source.typescript,
      script.code.source.scss,
      Boolean(script.shared),
      getScriptModulePath(script),
    ])
  );
}

export function getCompiledOutputBuildOptions(
  settings: Partial<EditorSettings>
): CompiledOutputBuildOptions {
  return {
    minifyCompiledOutput: settings.minifyCompiledOutput ?? false,
  };
}

export type UserscriptCompileSnapshot = {
  id: string;
  shared?: boolean;
  moduleName?: string;
  code: { source: { typescript: string; scss: string } };
};

export function hashUserscriptCompileSources(
  script: UserscriptCompileSnapshot
): string {
  return hashString(
    JSON.stringify([
      script.code.source.typescript,
      script.code.source.scss,
      Boolean(script.shared),
      getScriptModulePath(script),
    ])
  );
}

/**
 * True when `latest` was deleted or its compile inputs no longer match the
 * snapshot a rebuild started from. Callers must not write that snapshot's
 * compiled artifacts or source back to storage.
 */
export function isUserscriptCompileSnapshotStale(
  snapshot: UserscriptCompileSnapshot,
  latest: UserscriptCompileSnapshot | null | undefined
): boolean {
  if (!latest) {
    return true;
  }

  return (
    hashUserscriptCompileSources(latest) !==
    hashUserscriptCompileSources(snapshot)
  );
}

export function createCompiledCodeBuildMetadata(
  options: CompiledOutputBuildOptions
): CompiledCodeBuildMetadata {
  return {
    version: 1,
    ...(options.compilerContractVersion
      ? { compilerContractVersion: options.compilerContractVersion }
      : {}),
    ...(options.sourceDigest ? { sourceDigest: options.sourceDigest } : {}),
    minifyCompiledOutput: options.minifyCompiledOutput,
    ...(options.sourceHash ? { sourceHash: options.sourceHash } : {}),
  };
}

/**
 * Runtime freshness: compiled JS/CSS may only be injected when its stored
 * sourceHash matches the live sync source. Missing hashes are stale (legacy
 * local artifacts after a cross-device source change).
 */
export function isCompiledArtifactFresh(
  script: UserscriptCompileSnapshot,
  entry: CompiledCodeEntry | null | undefined,
  minifyCompiledOutput?: boolean
): boolean {
  if (!entry?.build?.sourceHash) {
    return false;
  }

  if (entry.build.sourceHash !== hashUserscriptCompileSources(script)) {
    return false;
  }

  if (
    minifyCompiledOutput !== undefined &&
    entry.build.minifyCompiledOutput !== minifyCompiledOutput
  ) {
    return false;
  }

  return true;
}

export function isCompiledCodeBuildCurrent(
  entry: CompiledCodeEntry | null | undefined,
  options: CompiledOutputBuildOptions
): boolean {
  if (
    options.compilerContractVersion !== undefined &&
    entry?.build?.compilerContractVersion !== options.compilerContractVersion
  ) {
    return false;
  }
  if (
    options.sourceDigest !== undefined &&
    entry?.build?.sourceDigest !== options.sourceDigest
  ) {
    return false;
  }
  if (
    entry?.build?.version !== 1 ||
    entry.build.minifyCompiledOutput !== options.minifyCompiledOutput
  ) {
    return false;
  }

  if (options.sourceHash !== undefined) {
    return entry.build.sourceHash === options.sourceHash;
  }

  return true;
}

export function buildCompiledCodeEntry(
  javascript: string,
  css: string,
  options: CompiledOutputBuildOptions
): CompiledCodeEntry {
  return {
    javascript,
    css,
    build: createCompiledCodeBuildMetadata(options),
  };
}

function hashString(input: string): string {
  let hash = 5381;

  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) + hash + input.charCodeAt(i);
    hash |= 0;
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
