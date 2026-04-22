import { CompiledCodeEntry } from "../model";

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
export class CompiledCodeStorage {
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
