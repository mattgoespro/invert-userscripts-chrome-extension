import { createAsyncThunk } from "@reduxjs/toolkit/react";
import type { Userscript } from "@shared/model";
import { reconcileStoredScripts } from "../../../services/storage-reconciliation";
import {
  storageSyncContext,
  type StorageSyncState,
} from "../editor-drafts/storage-sync-context";

/** Storage-only hydration uses the same current observation as refresh. */
export const loadUserscripts = createAsyncThunk<
  Userscript[],
  void,
  { state: StorageSyncState }
>("userscripts/loadUserscripts", async (_, { getState, dispatch }) => {
  const result = await reconcileStoredScripts(
    undefined,
    storageSyncContext(getState, dispatch)
  );
  return result.syncedScripts;
});
