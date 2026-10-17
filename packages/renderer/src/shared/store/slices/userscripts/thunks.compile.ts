import { createAction, createAsyncThunk } from "@reduxjs/toolkit/react";
import type { Userscript, CompiledCodeEntry } from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import {
  hashUserscriptCompileSources,
  isCompiledCodeBuildCurrent,
} from "@shared/compile-metadata";
import type { RootState } from "../../store";
import {
  observePublishedScripts,
  rebuildArtifact,
} from "../../../services/userscript-publication";
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
    const context = publicationContext(getState);
    const scope = args?.scope ?? "stale";
    // Discover candidates in bulk. Actual rebuilds still acquire publication
    // ownership and reread live source/cache before compiling or accepting output.
    const ids = await observePublishedScripts(
      undefined,
      async () => {
        const [scripts, compiled] = await Promise.all([
          ChromeSyncStorage.getAllScripts(),
          scope === "stale"
            ? CompiledCodeStorage.getAllCompiledCode()
            : Promise.resolve<Record<string, CompiledCodeEntry>>({}),
        ]);
        return { scripts, compiled };
      },
      ({ scripts, compiled }) => {
        const options = context.getBuildOptions();
        return Object.values(scripts)
          .filter(
            (script) =>
              scope === "all" ||
              (context.requiresModuleAnalysis &&
                !compiled[script.id]?.manifest) ||
              !isCompiledCodeBuildCurrent(compiled[script.id], {
                ...options,
                sourceHash: hashUserscriptCompileSources(script),
              })
          )
          .map((script) => script.id);
      }
    );
    const rebuiltScripts: Userscript[] = [];
    for (const id of ids) {
      const script = await rebuildArtifact(id, scope, context, (published) => {
        dispatch(acceptRebuiltArtifact(published));
      });
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
