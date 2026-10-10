import { acceptPublishedScript } from "./actions.publication";
import {
  persistDraftSave,
  type DraftSaveResult,
  type PersistScriptBuffersArgs,
} from "../../../services/draft-save-lifecycle";
import { publishMetadata } from "../../../services/userscript-publication";
import { publicationContext } from "./publication-context";
import { commitDraftForSave } from "../editor-drafts/actions";
import { createAsyncThunk } from "@reduxjs/toolkit/react";
import type { Userscript } from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import type { RootState } from "../../store";
import { compileAllOutputsOrThrow } from "./compile-helpers";
import { sendApplyScriptsMessage } from "./messaging";
import { PrettierFormatter } from "@/sandbox/formatter";

export const updateUserscript = createAsyncThunk<
  Userscript,
  { id: string; updates: Partial<Userscript> },
  { state: RootState }
>("userscripts/updateUserscript", ({ id, updates }, { getState, dispatch }) =>
  publishMetadata(id, updates, publicationContext(getState), (script) => {
    dispatch(acceptPublishedScript({ script, kind: "updated" }));
  })
);

export type { PersistScriptBuffersArgs } from "../../../services/draft-save-lifecycle";

/** The Redux adapter for the draft save lifecycle. */
export const persistScriptBuffers = createAsyncThunk<
  DraftSaveResult,
  PersistScriptBuffersArgs,
  { state: RootState }
>(
  "userscripts/persistScriptBuffers",
  async (args, { getState, dispatch, requestId }) =>
    persistDraftSave(args, {
      requestId,
      getState,
      sourceStorage: ChromeSyncStorage,
      compiledStorage: CompiledCodeStorage,
      compile: (script) => compileAllOutputsOrThrow(script, getState()),
      format: (code, language) => PrettierFormatter.format(code, language),
      acceptPublished: (script) => {
        dispatch(acceptPublishedScript({ script, kind: "updated" }));
      },
      apply: sendApplyScriptsMessage,
      commit: (payload) => {
        dispatch(commitDraftForSave(payload));
      },
    })
);
