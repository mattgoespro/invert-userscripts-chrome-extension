import { useAppDispatch } from "@/shared/store/hooks";
import { getAffectedScriptIdsFromStorageChanges } from "@/shared/store/slices/editor-drafts/helpers";
import { refreshScriptsFromStorage } from "@/shared/store/slices/editor-drafts/thunks.storage-sync";
import { rebuildCompiledUserscripts } from "@/shared/store/slices/userscripts/thunks.userscripts";
import { useEffect, useRef } from "react";

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
  const refreshInFlightRef = useRef(false);
  const pendingRefreshRef = useRef<string[] | "all" | null>(null);

  useEffect(() => {
    const mergePending = (scriptIds?: string[]) => {
      if (scriptIds === undefined || pendingRefreshRef.current === "all") {
        pendingRefreshRef.current = "all";
        return;
      }

      pendingRefreshRef.current = [
        ...new Set([...(pendingRefreshRef.current ?? []), ...scriptIds]),
      ];
    };

    const refresh = async (scriptIds?: string[]) => {
      if (refreshInFlightRef.current) {
        mergePending(scriptIds);
        return;
      }

      refreshInFlightRef.current = true;

      try {
        await dispatch(refreshScriptsFromStorage({ scriptIds })).unwrap();
      } catch (error) {
        console.error("Failed to refresh scripts from storage:", error);
      } finally {
        refreshInFlightRef.current = false;
      }

      const pending = pendingRefreshRef.current;
      pendingRefreshRef.current = null;

      if (pending === "all") {
        void refresh();
        return;
      }

      if (pending && pending.length > 0) {
        void refresh(pending);
        return;
      }

      try {
        await dispatch(rebuildCompiledUserscripts({ scope: "stale" })).unwrap();
      } catch (error) {
        console.error("Failed to rebuild stale compiled scripts:", error);
      }
    };

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

      void refresh(affectedIds);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [dispatch]);
}
