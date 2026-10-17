import { CompiledCodeEntry } from "../model";
import {
  transactionalEnabled,
  readRepository,
  commitRepository,
  writeLegacy,
} from "../publication/client";

const COMPILED_KEY_PREFIX = "compiled:";

/**
 * Manages compiled userscript code in `chrome.storage.local`.
 *
 * Compiled output (JavaScript + CSS) is stored separately from script metadata
 * because `chrome.storage.sync` has an 8KB-per-key quota that compiled code
 * easily exceeds. `chrome.storage.local` provides 5MB+ of capacity.
 *
 * Keys are stored as `compiled:{scriptId}` to avoid collisions.
 */
export class LegacyCompiledCodeStorage {
  /**
   * Persists compiled JavaScript and CSS for a single userscript.
   * @param scriptId - The userscript ID
   * @param entry - The compiled code entry containing JavaScript and CSS
   */
  static async saveCompiledCode(
    scriptId: string,
    entry: CompiledCodeEntry
  ): Promise<void> {
    const key = `${COMPILED_KEY_PREFIX}${scriptId}`;
    await chrome.storage.local.set({ [key]: entry });
  }

  /**
   * Retrieves compiled code for a single userscript.
   * @param scriptId - The userscript ID
   * @returns The compiled code entry, or `null` if none exists
   */
  static async getCompiledCode(
    scriptId: string
  ): Promise<CompiledCodeEntry | null> {
    const key = `${COMPILED_KEY_PREFIX}${scriptId}`;
    const result = await chrome.storage.local.get(key);
    return (result[key] as CompiledCodeEntry) ?? null;
  }

  /**
   * Retrieves compiled code entries for multiple userscripts efficiently.
   * @param scriptIds - Array of userscript IDs
   * @returns A record mapping script IDs to their compiled code
   */
  static async getCompiledCodeForScripts(
    scriptIds: string[]
  ): Promise<Record<string, CompiledCodeEntry>> {
    if (scriptIds.length === 0) {
      return {};
    }

    const keys = scriptIds.map((id) => `${COMPILED_KEY_PREFIX}${id}`);
    const result = await chrome.storage.local.get(keys);
    const entries: Record<string, CompiledCodeEntry> = {};

    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith(COMPILED_KEY_PREFIX)) {
        const scriptId = key.slice(COMPILED_KEY_PREFIX.length);
        entries[scriptId] = value as CompiledCodeEntry;
      }
    }

    return entries;
  }

  /**
   * Retrieves all compiled code entries, keyed by script ID.
   * @returns A record mapping script IDs to their compiled code
   */
  static async getAllCompiledCode(): Promise<
    Record<string, CompiledCodeEntry>
  > {
    const all = await chrome.storage.local.get(null);
    const entries: Record<string, CompiledCodeEntry> = {};

    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(COMPILED_KEY_PREFIX)) {
        const scriptId = key.slice(COMPILED_KEY_PREFIX.length);
        entries[scriptId] = value as CompiledCodeEntry;
      }
    }

    return entries;
  }

  /**
   * Deletes compiled code for a single userscript.
   * @param scriptId - The userscript ID
   */
  static async deleteCompiledCode(scriptId: string): Promise<void> {
    const key = `${COMPILED_KEY_PREFIX}${scriptId}`;
    await chrome.storage.local.remove(key);
  }

  /**
   * Removes compiled code entries that no longer have a matching script ID.
   * Call during startup or after bulk script deletion to reclaim storage.
   * @param validScriptIds - The set of script IDs that still exist
   */
  static async cleanupOrphaned(validScriptIds: Set<string>): Promise<void> {
    const all = await chrome.storage.local.get(null);
    const orphanedKeys: string[] = [];

    for (const key of Object.keys(all)) {
      if (key.startsWith(COMPILED_KEY_PREFIX)) {
        const scriptId = key.slice(COMPILED_KEY_PREFIX.length);
        if (!validScriptIds.has(scriptId)) {
          orphanedKeys.push(key);
        }
      }
    }

    if (orphanedKeys.length > 0) {
      await chrome.storage.local.remove(orphanedKeys);
    }
  }
}

export class CompiledCodeStorage extends LegacyCompiledCodeStorage {
  static async getAllCompiledCode(): Promise<
    Record<string, CompiledCodeEntry>
  > {
    return (await transactionalEnabled())
      ? (await readRepository()).artifacts
      : super.getAllCompiledCode();
  }
  static async getCompiledCode(id: string): Promise<CompiledCodeEntry | null> {
    return (await transactionalEnabled())
      ? ((await this.getAllCompiledCode())[id] ?? null)
      : super.getCompiledCode(id);
  }
  static async getCompiledCodeForScripts(
    ids: string[]
  ): Promise<Record<string, CompiledCodeEntry>> {
    if (!(await transactionalEnabled())) {
      return super.getCompiledCodeForScripts(ids);
    }
    const entries = await this.getAllCompiledCode();
    return Object.fromEntries(
      ids.filter((id) => entries[id]).map((id) => [id, entries[id]])
    );
  }
  static async saveCompiledCode(
    id: string,
    artifact: CompiledCodeEntry
  ): Promise<void> {
    if (!(await transactionalEnabled())) {
      return writeLegacy({ kind: "saveArtifact", id, artifact });
    }
    const snapshot = await readRepository();
    const document = snapshot.documents.find((item) => item.script.id === id);
    if (!document) {
      throw new Error("Compiled source was deleted: " + id);
    }
    await commitRepository({
      requestId: crypto.randomUUID(),
      writes: [{ id, expectedRevision: document.revision, artifact }],
    });
  }
  static async deleteCompiledCode(id: string): Promise<void> {
    // Source deletion removes its artifact in the same repository transaction.
    if (!(await transactionalEnabled())) {
      await writeLegacy({ kind: "deleteArtifact", id });
    }
  }
  static async cleanupOrphaned(ids: Set<string>): Promise<void> {
    if (!(await transactionalEnabled())) {
      await writeLegacy({ kind: "cleanupArtifacts", ids: [...ids] });
    }
  }
}
