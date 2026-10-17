import { findDuplicateModulePathScript } from "@shared/model";
import { LegacyChromeSyncStorage } from "@shared/storage/sync.storage";
import { legacyDocumentRevision } from "@shared/storage/indexeddb/migration";
import { serializeUserscript } from "@shared/storage/userscript-payload";
import type { IndexedDocumentRepository } from "@shared/storage/indexeddb/repository";
import {
  decodeSyncRevision,
  encodeSyncRevision,
  isSyncRevisionManifest,
  syncManifestKey,
} from "@shared/storage/sync/revision-codec";
import { mergeSyncRevision } from "@shared/storage/sync/replication";
import {
  isStoredScript,
  isGlobalModules,
  isEditorSettings,
} from "@shared/publication/protocol";
let drain: Promise<void> | undefined;
let schemaTransition: Promise<void> | undefined;
export async function enableVerifiedReplication(
  repository: IndexedDocumentRepository
): Promise<void> {
  if (!schemaTransition) {
    schemaTransition = (async () => {
      // New flushes wait here; the already-running v2 drain must finish first.
      await drain?.catch(() => {});
      const flags = await chrome.storage.local.get("verifiedSync");
      if (flags.verifiedSync) {
        return;
      }
      await chrome.storage.local.set({
        preVerifiedSyncBackup: await repository.snapshot(),
      });
      await repository.update((state) => {
        for (const document of Object.values(state.documents)) {
          state.outbox[document.revision] = {
            id: document.script.id,
            ...document,
          };
        }
        for (const [id, tombstone] of Object.entries(state.tombstones)) {
          state.outbox[tombstone.revision] = { id, ...tombstone };
        }
        return { state, value: undefined };
      });
      await chrome.storage.local.set({ verifiedSync: true });
    })().finally(() => {
      schemaTransition = undefined;
    });
  }
  await schemaTransition;
  await flushSync(repository);
}
export async function flushSync(
  repository: IndexedDocumentRepository
): Promise<void> {
  if (schemaTransition) {
    await schemaTransition;
    return flushSync(repository);
  }
  if (drain) {
    return drain;
  }
  drain = (async () => {
    const verified =
      (await chrome.storage.local.get("verifiedSync")).verifiedSync === true;
    for (;;) {
      const state = await repository.state();
      for (const entry of Object.values(state.outbox)) {
        if (verified) {
          const encoded = await encodeSyncRevision(
            entry.script
              ? {
                  script: entry.script,
                  revision: entry.revision,
                  parents: entry.parents,
                }
              : entry,
            entry.parents
          );
          // Chrome accounts for JSON key/value bytes. Existing keys must not be charged twice.
          const all = await chrome.storage.sync.get(null);
          const additions = {
            ...encoded.chunks,
            [syncManifestKey(entry.id, entry.revision)]: encoded.manifest,
          };
          const merged = { ...all, ...additions };
          const bytes = Object.entries(merged).reduce(
            (sum, [key, value]) =>
              sum +
              new TextEncoder().encode(key + JSON.stringify(value)).length,
            0
          );
          if (bytes > chrome.storage.sync.QUOTA_BYTES) {
            throw new Error(
              "Sync quota is full. Your changes are saved locally."
            );
          }
          await chrome.storage.sync.set(encoded.chunks);
          await chrome.storage.sync.set({
            [syncManifestKey(entry.id, entry.revision)]: encoded.manifest,
          });
          await repository.update((current) => {
            current.syncRecords[entry.revision] = encoded.manifest;
            return { state: current, value: undefined };
          });
        } else if (entry.script) {
          const alias = await legacyDocumentRevision(entry.script);
          await repository.update((current) => {
            current.legacyEmitted ??= {};
            current.legacyEmitted[alias] = {
              id: entry.id,
              revision: entry.revision,
            };
            return { state: current, value: undefined };
          });
          await LegacyChromeSyncStorage.saveScript(entry.script);
        } else {
          await LegacyChromeSyncStorage.deleteScript(entry.id);
        }
        await repository.update((current) => {
          delete current.outbox[entry.revision];
          return { state: current, value: undefined };
        });
      }
      if (state.preferenceOutbox?.modules) {
        await chrome.storage.sync.set({ globalModules: state.modules });
      }
      if (state.preferenceOutbox?.settings) {
        await chrome.storage.sync.set({ editorSettings: state.settings });
      }
      await repository.update((current) => {
        current.preferenceOutbox ??= {};
        for (const field of ["modules", "settings"] as const) {
          if (
            current.preferenceOutbox[field] === state.preferenceOutbox?.[field]
          ) {
            delete current.preferenceOutbox[field];
          }
        }
        return { state: current, value: undefined };
      });
      const pending = await repository.state();
      if (
        !Object.keys(pending.outbox).length &&
        !Object.keys(pending.preferenceOutbox).length
      ) {
        break;
      }
    }
    await chrome.storage.local.set({
      publicationSyncStatus: { status: "synced", updatedAt: Date.now() },
    });
    await chrome.alarms.clear("publication-sync-retry");
    await chrome.storage.local.remove("publicationSyncRetries");
  })()
    .catch(async (error) => {
      await chrome.storage.local.set({
        publicationSyncStatus: {
          status: "pending",
          message: error instanceof Error ? error.message : String(error),
          updatedAt: Date.now(),
        },
      });
      const retries = (await chrome.storage.local.get("publicationSyncRetries"))
        .publicationSyncRetries;
      const attempts = (typeof retries === "number" ? retries : 0) + 1;
      await chrome.storage.local.set({ publicationSyncRetries: attempts });
      if (attempts <= 10) {
        await chrome.alarms.create("publication-sync-retry", {
          delayInMinutes: Math.min(60, 0.5 * 2 ** (attempts - 1)),
        });
      }
      throw error;
    })
    .finally(() => {
      drain = undefined;
    });
  return drain;
}
export async function ingestPortablePreferences(
  repository: IndexedDocumentRepository
): Promise<boolean> {
  const incoming = await chrome.storage.sync.get([
    "globalModules",
    "editorSettings",
  ]);
  return repository.update((state) => {
    let changed = false;
    if (
      isGlobalModules(incoming.globalModules) &&
      !state.preferenceOutbox?.modules &&
      JSON.stringify(incoming.globalModules) !== JSON.stringify(state.modules)
    ) {
      state.modules = incoming.globalModules;
      state.moduleRevision = crypto.randomUUID();
      changed = true;
    }
    if (
      isEditorSettings(incoming.editorSettings) &&
      !state.preferenceOutbox?.settings &&
      JSON.stringify(incoming.editorSettings) !== JSON.stringify(state.settings)
    ) {
      state.settings = incoming.editorSettings;
      state.settingsRevision = crypto.randomUUID();
      changed = true;
    }
    if (changed) {
      state.generation++;
    }
    return { state, value: changed };
  });
}
/** Transitional v2 replication retains legacy arrival semantics until verified sync is enabled. */
export async function ingestLegacySync(
  repository: IndexedDocumentRepository
): Promise<boolean> {
  const scripts = await LegacyChromeSyncStorage.getAllScripts();
  const revisions = Object.fromEntries(
    await Promise.all(
      Object.values(scripts).map(async (script) => [
        script.id,
        await legacyDocumentRevision(script),
      ])
    )
  );
  const observed = await repository.state();
  const present = new Set<string>();
  for (const id of Object.keys(observed.documents)) {
    if (!scripts[id] && (await LegacyChromeSyncStorage.hasScriptManifest(id))) {
      present.add(id);
    }
  }
  return repository.update((state) => {
    state.legacyObserved ??= {};
    let changed = false;
    for (const [id, script] of Object.entries(scripts)) {
      const revision = revisions[id];
      if (state.legacyObserved[id] === revision) {
        continue;
      }
      const local = state.documents[id];
      const ownEcho = state.legacyEmitted?.[revision];
      if (ownEcho) {
        state.syncRecords[revision] = { revision, parents: [ownEcho.revision] };
        if (local?.revision === ownEcho.revision) {
          state.legacyObserved[id] = revision;
        }
        continue;
      }
      const parents = state.legacyObserved[id]
        ? [state.legacyObserved[id]]
        : [];
      if (
        local &&
        JSON.stringify(serializeUserscript(local.script)) ===
          JSON.stringify(serializeUserscript(script))
      ) {
        state.syncRecords[revision] = { revision, parents: [local.revision] };
        state.legacyObserved[id] = revision;
        continue;
      }
      state.syncRecords[revision] = { revision, parents };
      if (Object.values(state.outbox).some((entry) => entry.id === id)) {
        state.syncHeads[id] = mergeSyncRevision(
          state.syncHeads[id] ?? [],
          { revision, parents },
          state.syncRecords
        ).heads;
        state.syncConflicts[id] = [{ id, revision, parents, script }];
      } else if (
        findDuplicateModulePathScript(
          Object.values(state.documents).map((document) => document.script),
          script
        )
      ) {
        state.syncHeads[id] = [revision];
        state.syncConflicts[id] = [
          {
            id,
            revision,
            parents,
            script,
            conflictReason:
              "Another saved script already uses this module alias. Rename that alias or discard the incoming version.",
          },
        ];
      } else {
        state.cssOutbox ??= {};
        state.cssOutbox[id] = revision;
        state.documents[id] = { script, revision, parents };
        delete state.artifacts[id];
        state.syncRecords[revision] = { revision, parents };
        state.syncHeads[id] = [revision];
      }
      state.legacyObserved[id] = revision;
      changed = true;
    }
    for (const id of Object.keys(state.documents)) {
      if (
        !scripts[id] &&
        !present.has(id) &&
        state.legacyObserved[id] &&
        !Object.values(state.outbox).some((entry) => entry.id === id)
      ) {
        const revision = crypto.randomUUID();
        const parents = [state.documents[id].revision];
        state.cssOutbox ??= {};
        state.cssOutbox[id] = revision;
        delete state.documents[id];
        delete state.artifacts[id];
        state.tombstones[id] = { revision, parents };
        state.syncHeads[id] = [revision];
        state.syncRecords[revision] = { revision, parents };
        delete state.legacyObserved[id];
        changed = true;
      }
    }
    if (changed) {
      state.generation++;
    }
    return { state, value: changed };
  });
}
export async function ingestVerifiedSync(
  repository: IndexedDocumentRepository
): Promise<void> {
  const all = await chrome.storage.sync.get(null);
  const decoded = await Promise.all(
    Object.entries(all)
      .filter(
        ([key, value]) =>
          isSyncRevisionManifest(value) &&
          key === syncManifestKey(value.id, value.revision)
      )
      .map(([, manifest]) =>
        decodeSyncRevision(
          manifest as import("@shared/storage/sync/revision-codec").SyncRevisionManifest,
          all
        )
      )
  );
  // Complete records first: causal ancestry may arrive in the same unordered batch.
  await repository.update((state) => {
    const complete = decoded.filter(
      (item) =>
        item.status === "complete" &&
        (!item.document ||
          isStoredScript(item.document.script, item.manifest.id))
    );
    const ids = new Set<string>();
    for (const item of complete) {
      if (item.status !== "complete") {
        continue;
      }
      state.syncRecords[item.manifest.revision] = item.manifest;
      ids.add(item.manifest.id);
    }
    for (const id of ids) {
      const items = complete.filter(
        (item) => item.status === "complete" && item.manifest.id === id
      );
      let heads = state.syncHeads[id] ?? [];
      for (const item of items) {
        if (item.status === "complete") {
          heads = mergeSyncRevision(
            heads,
            item.manifest,
            state.syncRecords
          ).heads;
        }
      }
      const previousHeads = state.syncHeads[id] ?? [];
      const headChanged =
        heads.length !== previousHeads.length ||
        heads.some((head) => !previousHeads.includes(head));
      state.syncHeads[id] = heads;
      const candidates = new Map(
        (state.syncConflicts[id] ?? []).map((entry) => [entry.revision, entry])
      );
      const local = state.documents[id];
      if (local) {
        candidates.set(local.revision, { id, ...local });
      }
      const tombstone = state.tombstones[id];
      if (tombstone) {
        candidates.set(tombstone.revision, { id, ...tombstone });
      }
      for (const item of items) {
        if (item.status === "complete") {
          candidates.set(item.manifest.revision, {
            id,
            revision: item.manifest.revision,
            parents: item.manifest.parents,
            script: item.document?.script,
          });
        }
      }
      if (heads.length > 1) {
        const conflicts = heads
          .filter((head) => head !== local?.revision)
          .map((head) => candidates.get(head))
          .filter((entry) => Boolean(entry));
        if (
          JSON.stringify(state.syncConflicts[id]) !== JSON.stringify(conflicts)
        ) {
          state.generation++;
        }
        state.syncConflicts[id] = conflicts;
      } else {
        const winner = candidates.get(heads[0]);
        if (!winner) {
          continue;
        }
        if (
          winner.script &&
          findDuplicateModulePathScript(
            Object.values(state.documents).map((document) => document.script),
            winner.script
          )
        ) {
          const conflict = {
            ...winner,
            conflictReason:
              "Another saved script already uses this module alias. Rename that alias or discard the incoming version.",
          };
          if (
            JSON.stringify(state.syncConflicts[id]) !==
            JSON.stringify([conflict])
          ) {
            state.generation++;
          }
          state.syncConflicts[id] = [conflict];
          continue;
        }
        const changed =
          winner.revision !== (local?.revision ?? tombstone?.revision) ||
          Boolean(state.syncConflicts[id]);
        delete state.syncConflicts[id];
        if (winner.script) {
          state.documents[id] = {
            script: winner.script,
            revision: winner.revision,
            parents: winner.parents,
          };
          delete state.tombstones[id];
        } else {
          delete state.documents[id];
          state.tombstones[id] = {
            revision: winner.revision,
            parents: winner.parents,
          };
        }
        if (changed) {
          state.cssOutbox ??= {};
          state.cssOutbox[id] = winner.revision;
          delete state.artifacts[id];
          state.generation++;
        }
      }
      if (headChanged) {
        state.generation++;
      }
    }
    return { state, value: undefined };
  });
}
