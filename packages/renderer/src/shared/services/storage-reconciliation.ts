import { observePublishedScripts } from "./userscript-publication";
import type { Userscript } from "@shared/model";
import type { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import { hydrateUserscriptWithCompiled } from "@shared/userscript-hydrate";
import type {
  EditorDraft,
  RemoteDraftConflict,
} from "../store/slices/editor-drafts/state.editor-drafts";
import { decideStorageSyncAction } from "../store/slices/editor-drafts/storage-sync-decision";

export interface StorageRefreshResult {
  syncedScripts: Userscript[];
  conflictIds: string[];
}

export interface StorageReconciliationContext {
  sourceStorage: Pick<
    typeof ChromeSyncStorage,
    "getAllScripts" | "hasScriptManifest"
  >;
  compiledStorage: Pick<typeof CompiledCodeStorage, "getAllCompiledCode">;
  getScriptIds: () => string[];
  syncScripts: (scripts: Userscript[]) => void;
  getDrafts: () => Record<string, EditorDraft>;
  removeDraft: (scriptId: string) => void;
  enqueueConflict: (conflict: RemoteDraftConflict) => void;
  syncDraft: (script: Userscript) => void;
  removeScripts: (scriptIds: string[]) => void;
}

/** Reconcile a stored snapshot against drafts read after storage awaits. */
export async function reconcileStoredScripts(
  scriptIds: string[] | undefined,
  context: StorageReconciliationContext
): Promise<StorageRefreshResult> {
  return observePublishedScripts(
    scriptIds,
    async () => {
      const [scriptsMap, compiledCodeMap] = await Promise.all([
        context.sourceStorage.getAllScripts(),
        context.compiledStorage.getAllCompiledCode(),
      ]);
      const targetIds = scriptIds ?? [
        ...new Set([
          ...context.getScriptIds(),
          ...Object.keys(context.getDrafts()),
          ...Object.keys(scriptsMap),
        ]),
      ];
      const presentManifests = new Set<string>();
      await Promise.all(
        targetIds
          .filter((id) => !scriptsMap[id])
          .map(async (id) => {
            if (await context.sourceStorage.hasScriptManifest(id)) {
              presentManifests.add(id);
            }
          })
      );
      return { scriptsMap, compiledCodeMap, targetIds, presentManifests };
    },
    ({ scriptsMap, compiledCodeMap, targetIds, presentManifests }) => {
      const syncedScripts: Userscript[] = [];
      const conflictIds: string[] = [];
      const removedIds: string[] = [];
      // No awaits here: evaluate live drafts only after every storage check.
      for (const scriptId of targetIds) {
        const remote = scriptsMap[scriptId];
        if (!remote && presentManifests.has(scriptId)) {
          continue;
        }
        const hydrated = remote
          ? hydrateUserscriptWithCompiled(remote, compiledCodeMap[scriptId])
          : undefined;
        const decision = decideStorageSyncAction(
          scriptId,
          context.getDrafts()[scriptId],
          hydrated
        );
        switch (decision.action) {
          case "keep-dirty-orphan":
            break;
          case "remove":
            context.removeDraft(scriptId);
            removedIds.push(scriptId);
            break;
          case "conflict":
            context.enqueueConflict(decision.conflict);
            conflictIds.push(scriptId);
            break;
          case "sync-entity":
            syncedScripts.push(decision.script);
            break;
          case "sync":
            context.syncDraft(decision.script);
            syncedScripts.push(decision.script);
            break;
        }
      }
      if (removedIds.length > 0) {
        context.removeScripts(removedIds);
      }
      if (syncedScripts.length > 0) {
        context.syncScripts(syncedScripts);
      }
      return { syncedScripts, conflictIds };
    }
  );
}

export interface StorageSyncCoordinator {
  requestRefresh: (scriptIds?: string[]) => Promise<void>;
  dispose: () => void;
}

export interface StorageSyncEffects {
  refresh: (scriptIds?: string[]) => Promise<unknown>;
  rebuild: () => Promise<unknown>;
  onError: (phase: "refresh" | "rebuild", error: unknown) => void;
}

/** One drain owns refreshes and rebuilds; events during either phase queue. */
export function createStorageSyncCoordinator(
  effects: StorageSyncEffects
): StorageSyncCoordinator {
  let pending: string[] | "all" | null = null;
  let running = false;
  let disposed = false;
  let task = Promise.resolve();

  const drain = async (): Promise<void> => {
    running = true;
    try {
      while (!disposed && pending !== null) {
        const next = pending;
        pending = null;
        try {
          await effects.refresh(next === "all" ? undefined : next);
        } catch (error) {
          effects.onError("refresh", error);
        }
        if (disposed) {
          return;
        }
        if (pending !== null) {
          continue;
        }
        try {
          await effects.rebuild();
        } catch (error) {
          effects.onError("rebuild", error);
        }
      }
    } finally {
      running = false;
    }
  };

  return {
    requestRefresh: (scriptIds?: string[]): Promise<void> => {
      if (disposed) {
        return Promise.resolve();
      }
      if (scriptIds === undefined || pending === "all") {
        pending = "all";
      } else {
        pending = [...new Set([...(pending ?? []), ...scriptIds])];
      }
      if (!running) {
        task = drain();
      }
      return task;
    },
    dispose: (): void => {
      disposed = true;
      pending = null;
    },
  };
}
