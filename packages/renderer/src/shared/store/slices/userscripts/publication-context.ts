import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import type { PublicationContext } from "../../../services/userscript-publication";
import type { RootState } from "../../store";
import {
  compileAllOutputsOrThrow,
  compileJavascriptOrThrow,
  getBuildOptions,
} from "./compile-helpers";

export function publicationContext(
  getState: () => RootState
): PublicationContext {
  return {
    requiresModuleAnalysis: true,
    sourceStorage: ChromeSyncStorage,
    compiledStorage: CompiledCodeStorage,
    getLocalScripts: () => getState().userscripts.scripts ?? {},
    getBuildOptions: () => getBuildOptions(getState()),
    compileAll: (script) => compileAllOutputsOrThrow(script, getState()),
    compileJavascript: (script) => compileJavascriptOrThrow(script, getState()),
  };
}
