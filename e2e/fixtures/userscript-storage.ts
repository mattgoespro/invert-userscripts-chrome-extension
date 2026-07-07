import type { Userscript } from "../../packages/shared/src/model";

type StoredUserscriptPayload = {
  name: string;
  enabled?: true;
  status?: Userscript["status"];
  error?: true;
  shared?: true;
  moduleName?: string;
  sharedScripts?: string[];
  globalModules?: string[];
  typeDefinitions?: string;
  code?: {
    source?: {
      typescript?: string;
      scss?: string;
    };
    compiled?: {
      javascript?: string;
      css?: string;
    };
  };
  urlPatterns?: string[];
  runAt?: Userscript["runAt"];
  createdAt: number;
  updatedAt: number;
};

type StoredUserscriptManifest = {
  version: 2;
  encoding: "utf8-base64";
  mode: "inline";
  data: string;
};

/** Mirrors ChromeSyncStorage.serializeUserscript for e2e seed data. */
function serializeUserscript(script: Userscript): StoredUserscriptPayload {
  const payload: StoredUserscriptPayload = {
    name: script.name,
    createdAt: script.createdAt,
    updatedAt: script.updatedAt,
  };

  if (script.enabled) {
    payload.enabled = true;
  }

  if (script.status === "modified") {
    payload.status = script.status;
  }

  if (script.error) {
    payload.error = true;
  }

  if (script.shared) {
    payload.shared = true;
  }

  if (script.moduleName.trim().length > 0) {
    payload.moduleName = script.moduleName;
  }

  if (script.sharedScripts.length > 0) {
    payload.sharedScripts = [...script.sharedScripts];
  }

  if (script.globalModules.length > 0) {
    payload.globalModules = [...script.globalModules];
  }

  if (script.typeDefinitions.length > 0) {
    payload.typeDefinitions = script.typeDefinitions;
  }

  const typescriptSource = script.code.source.typescript;
  const scssSource = script.code.source.scss;

  if (typescriptSource.length > 0 || scssSource.length > 0) {
    payload.code = {
      source: {
        ...(typescriptSource.length > 0
          ? { typescript: typescriptSource }
          : {}),
        ...(scssSource.length > 0 ? { scss: scssSource } : {}),
      },
    };
  }

  if (script.urlPatterns.length > 0) {
    payload.urlPatterns = [...script.urlPatterns];
  }

  if (script.runAt === "afterPageLoad") {
    payload.runAt = script.runAt;
  }

  return payload;
}

export function buildUserscriptSyncManifest(
  script: Userscript
): StoredUserscriptManifest {
  const json = JSON.stringify(serializeUserscript(script));

  return {
    version: 2,
    encoding: "utf8-base64",
    mode: "inline",
    data: Buffer.from(json, "utf-8").toString("base64"),
  };
}

export function buildUserscriptSyncEntries(
  syncData: Record<string, unknown>
): Record<string, unknown> {
  const entries: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(syncData)) {
    if (key.startsWith("userscript:") && value && typeof value === "object") {
      entries[key] = buildUserscriptSyncManifest(value as Userscript);
      continue;
    }

    entries[key] = value;
  }

  return entries;
}
