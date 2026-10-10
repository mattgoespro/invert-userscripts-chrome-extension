import { createAction } from "@reduxjs/toolkit";
import type { Userscript } from "@shared/model";

/** Durable publication is accepted before unrelated tab-application feedback. */
export const acceptPublishedScript = createAction<{
  script: Userscript;
  kind: "created" | "imported" | "updated" | "toggled";
}>("userscripts/acceptPublishedScript");

export const acceptDeletedScript = createAction<string>(
  "userscripts/acceptDeletedScript"
);

export const syncScriptsFromRemote = createAction<Userscript[]>(
  "userscripts/syncScriptsFromRemote"
);
export const removeRemoteScripts = createAction<string[]>(
  "userscripts/removeRemoteScripts"
);
