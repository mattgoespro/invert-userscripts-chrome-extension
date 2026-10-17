import type { SavedDocument } from "../../publication/contracts";

export interface SyncRevisionManifest {
  version: 3;
  id: string;
  revision: string;
  parents: string[];
  deleted: boolean;
  encoding: "utf8-base64";
  byteLength: number;
  chunkCount: number;
  digest: string;
}
export interface EncodedSyncRevision {
  manifest: SyncRevisionManifest;
  chunks: Record<string, string>;
}
export type DecodedSyncRevision =
  | {
      status: "complete";
      document: SavedDocument | null;
      manifest: SyncRevisionManifest;
    }
  | { status: "incomplete" | "corrupt" };
export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
export function syncChunkKey(
  id: string,
  revision: string,
  index: number
): string {
  return (
    "revision:" +
    encodeURIComponent(id) +
    ":" +
    encodeURIComponent(revision) +
    ":chunk:" +
    index
  );
}
export function syncManifestKey(id: string, revision: string): string {
  return (
    "revision:" +
    encodeURIComponent(id) +
    ":" +
    encodeURIComponent(revision) +
    ":manifest"
  );
}
export async function encodeSyncRevision(
  document: SavedDocument | { revision: string; id: string },
  parents: string[]
): Promise<EncodedSyncRevision> {
  const deleted = !("script" in document);
  const id = deleted ? document.id : document.script.id;
  const payload = JSON.stringify(deleted ? null : document.script);
  const bytes = new TextEncoder().encode(payload);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const encoded = btoa(binary);
  const chunks: Record<string, string> = {};
  for (
    let offset = 0, index = 0;
    offset < encoded.length;
    offset += 6000, index++
  ) {
    chunks[syncChunkKey(id, document.revision, index)] = encoded.slice(
      offset,
      offset + 6000
    );
  }
  return {
    manifest: {
      version: 3,
      id,
      revision: document.revision,
      parents: [...parents],
      deleted,
      encoding: "utf8-base64",
      byteLength: bytes.length,
      chunkCount: Object.keys(chunks).length,
      digest: await revisionDigest(
        { id, revision: document.revision, parents, deleted },
        payload
      ),
    },
    chunks,
  };
}
async function revisionDigest(
  identity: {
    id: string;
    revision: string;
    parents: string[];
    deleted: boolean;
  },
  payload: string
): Promise<string> {
  return sha256(
    JSON.stringify([
      3,
      identity.id,
      identity.revision,
      identity.parents,
      identity.deleted,
      payload,
    ])
  );
}
function validIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !["__proto__", "constructor", "prototype"].includes(value)
  );
}
export function isSyncRevisionManifest(
  value: unknown
): value is SyncRevisionManifest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as SyncRevisionManifest;
  return (
    item.version === 3 &&
    validIdentifier(item.id) &&
    validIdentifier(item.revision) &&
    Array.isArray(item.parents) &&
    item.parents.length <= 100 &&
    item.parents.every(
      (parent) => validIdentifier(parent) && parent !== item.revision
    ) &&
    typeof item.deleted === "boolean" &&
    item.encoding === "utf8-base64" &&
    Number.isInteger(item.chunkCount) &&
    item.chunkCount > 0 &&
    item.chunkCount <= 512 &&
    Number.isInteger(item.byteLength) &&
    item.byteLength >= 0 &&
    item.byteLength <= 102400 &&
    typeof item.digest === "string" &&
    /^[a-f0-9]{64}$/.test(item.digest)
  );
}
export async function decodeSyncRevision(
  manifest: SyncRevisionManifest,
  chunks: Record<string, unknown>
): Promise<DecodedSyncRevision> {
  if (!isSyncRevisionManifest(manifest)) {
    return { status: "corrupt" };
  }
  let encoded = "";
  for (let index = 0; index < manifest.chunkCount; index++) {
    const chunk = chunks[syncChunkKey(manifest.id, manifest.revision, index)];
    if (typeof chunk !== "string") {
      return { status: "incomplete" };
    }
    encoded += chunk;
  }
  try {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const payload = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (
      bytes.length !== manifest.byteLength ||
      (await revisionDigest(manifest, payload)) !== manifest.digest
    ) {
      return { status: "corrupt" };
    }
    const script = JSON.parse(payload);
    if (
      manifest.deleted
        ? script !== null
        : !script ||
          script.id !== manifest.id ||
          typeof script.name !== "string" ||
          typeof script.code?.source?.typescript !== "string" ||
          typeof script.code?.source?.scss !== "string"
    ) {
      return { status: "corrupt" };
    }
    return {
      status: "complete",
      manifest,
      document: script
        ? { script, revision: manifest.revision, parents: manifest.parents }
        : null,
    };
  } catch {
    return { status: "corrupt" };
  }
}
