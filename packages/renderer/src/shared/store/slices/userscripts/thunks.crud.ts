import {
  acceptDeletedScript,
  acceptPublishedScript,
} from "./actions.publication";
import { createAsyncThunk } from "@reduxjs/toolkit/react";
import type { Userscript } from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import {
  publishNewScript,
  publishEnabledToggle,
  removePublishedScript,
} from "../../../services/userscript-publication";
import { uuid } from "@shared/utils";
import { sendSetEnabledMessage } from "./messaging";
import { DefaultNewUserscriptName } from "./state.userscripts";

export const createUserscript = createAsyncThunk(
  "userscripts/createUserscript",
  async (_, { dispatch }) => {
    const timestamp = Date.now();
    const id = uuid();
    const script: Userscript = {
      id,
      name: DefaultNewUserscriptName,
      enabled: false,
      status: "saved",
      shared: false,
      moduleName: "",
      sharedScripts: [],
      globalModules: [],
      typeDefinitions: "",
      code: {
        source: {
          typescript: "// Your code here",
          scss: "/* Your styles here */",
        },
        compiled: {
          javascript: "",
          css: "",
        },
      },
      urlPatterns: ["*://*/*"],
      runAt: "afterPageLoad",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await publishNewScript(
      script,
      {
        sourceStorage: ChromeSyncStorage,
        compiledStorage: CompiledCodeStorage,
      },
      async () => {
        const settings = await ChromeSyncStorage.getEditorSettings();
        return { minifyCompiledOutput: settings.minifyCompiledOutput ?? false };
      },
      (published) => {
        dispatch(acceptPublishedScript({ script: published, kind: "created" }));
      }
    );
    return script;
  }
);

export const deleteUserscript = createAsyncThunk(
  "userscripts/deleteUserscript",
  async (scriptId: string, { dispatch }) => {
    await removePublishedScript(
      scriptId,
      ChromeSyncStorage,
      CompiledCodeStorage,
      (id) => {
        dispatch(acceptDeletedScript(id));
      }
    );
    return scriptId;
  }
);

export const toggleUserscript = createAsyncThunk(
  "userscripts/toggleUserscript",
  async (scriptId: string, { dispatch }) => {
    const { script: updatedScript, applyResult } = await publishEnabledToggle(
      scriptId,
      ChromeSyncStorage,
      (script) => {
        dispatch(acceptPublishedScript({ script, kind: "toggled" }));
      },
      sendSetEnabledMessage
    );

    return {
      script: updatedScript,
      appliedTabCount: applyResult.appliedTabCount,
      removedTabCount: applyResult.removedTabCount ?? 0,
      applySuccess: applyResult.success,
      staleSkipCount: applyResult.staleSkipCount ?? 0,
    };
  }
);
