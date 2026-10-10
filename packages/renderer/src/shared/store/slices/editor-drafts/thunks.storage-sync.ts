import { reconcileStoredScripts } from "../../../services/storage-reconciliation";
import { createAsyncThunk } from "@reduxjs/toolkit/react";
import type { Userscript } from "@shared/model";
import type { RootState } from "../../store";
import { storageSyncContext } from "./storage-sync-context";

export const refreshScriptsFromStorage = createAsyncThunk<
  { syncedScripts: Userscript[]; conflictIds: string[] },
  { scriptIds?: string[] } | undefined,
  { state: RootState }
>(
  "editorDrafts/refreshScriptsFromStorage",
  async (args, { getState, dispatch }) =>
    reconcileStoredScripts(
      args?.scriptIds,
      storageSyncContext(getState, dispatch)
    )
);
