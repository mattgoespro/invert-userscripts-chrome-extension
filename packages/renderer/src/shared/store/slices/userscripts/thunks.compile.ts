import { createAction, createAsyncThunk } from "@reduxjs/toolkit/react";
import type { Userscript } from "@shared/model";
import { ChromeSyncStorage } from "@shared/storage";
import type { RootState } from "../../store";
import { rebuildArtifact } from "../../../services/userscript-publication";
import { publicationContext } from "./publication-context";
import { sendApplyScriptsMessage } from "./messaging";

export const acceptRebuiltArtifact = createAction<Userscript>(
  "userscripts/acceptRebuiltArtifact"
);

export const rebuildCompiledUserscripts = createAsyncThunk<
  Userscript[],
  { scope?: "stale" | "all" } | undefined,
  { state: RootState }
>(
  "userscripts/rebuildCompiledUserscripts",
  async (args, { getState, dispatch }) => {
    const ids = Object.keys(await ChromeSyncStorage.getAllScripts());
    const context = publicationContext(getState);
    const rebuiltScripts: Userscript[] = [];
    for (const id of ids) {
      const script = await rebuildArtifact(
        id,
        args?.scope ?? "stale",
        context,
        (published) => {
          dispatch(acceptRebuiltArtifact(published));
        }
      );
      if (script) {
        rebuiltScripts.push(script);
      }
    }
    if (rebuiltScripts.length > 0) {
      const result = await sendApplyScriptsMessage(
        rebuiltScripts.map((script) => script.id)
      );
      if (!result.success) {
        console.error(
          "Failed to apply rebuilt scripts to matching tabs:",
          result
        );
      }
    }
    return rebuiltScripts;
  }
);
