import { createStorageSyncCoordinator } from "@/shared/services/storage-reconciliation";
import { useAppDispatch } from "@/shared/store/hooks";
import { getAffectedScriptIdsFromStorageChanges } from "@/shared/store/slices/editor-drafts/helpers";
import { refreshScriptsFromStorage } from "@/shared/store/slices/editor-drafts/thunks.storage-sync";
import { rebuildCompiledUserscripts } from "@/shared/store/slices/userscripts/thunks.userscripts";
import { useEffect } from "react";
import { loadModules } from "@/shared/store/slices/modules";
import { loadSettings } from "@/shared/store/slices/settings/thunks.settings";

/**
 * Keep IDE drafts/entities reconciled with chrome.storage.sync.
 *
 * - `onChanged` is the primary signal for same- and cross-context writes.
 * - `visibilitychange` catches missed events when returning to a backgrounded
 *   IDE tab (e.g. another IDE window wrote while this one was hidden).
 * - Full refreshes on every `pageshow` were dropped; bfcache restores still
 *   fire visibility when shown.
 */
export function useStorageSync() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const coordinator = createStorageSyncCoordinator({
      refresh: (scriptIds) =>
        dispatch(refreshScriptsFromStorage({ scriptIds })).unwrap(),
      rebuild: () =>
        dispatch(rebuildCompiledUserscripts({ scope: "stale" })).unwrap(),
      onError: (phase, error) => {
        console.error(
          phase === "refresh"
            ? "Failed to refresh scripts from storage:"
            : "Failed to rebuild stale compiled scripts:",
          error
        );
      },
    });

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "sync") {
        return;
      }

      const affectedIds = getAffectedScriptIdsFromStorageChanges(changes);

      if (affectedIds.length === 0) {
        return;
      }

      void coordinator.requestRefresh(affectedIds);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void coordinator.requestRefresh();
      }
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    const onPublication = (message: { type?: string }) => {
      if (message?.type === "publicationCommitted") {
        void coordinator.requestRefresh();
        void dispatch(loadModules());
        void dispatch(loadSettings());
      }
    };
    chrome.runtime.onMessage.addListener(onPublication);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      coordinator.dispose();
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.runtime.onMessage.removeListener(onPublication);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [dispatch]);
}
