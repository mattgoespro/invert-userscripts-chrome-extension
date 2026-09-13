import { createAsyncThunk } from "@reduxjs/toolkit/react";
import {
  buildCompiledCodeEntry,
  hashUserscriptCompileSources,
} from "@shared/compile-metadata";
import type { Userscript } from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import {
  normalizeUserscript,
  toStorageSafeUserscript,
} from "@shared/userscript-hydrate";
import { uuid } from "@shared/utils";
import { sendSetEnabledMessage } from "./messaging";
import { DefaultNewUserscriptName } from "./state.userscripts";

export const createUserscript = createAsyncThunk(
  "userscripts/createUserscript",
  async () => {
    const timestamp = Date.now();
    const id = uuid();
    const script: Userscript = {
      id,
      name: DefaultNewUserscriptName,
      enabled: false,
      status: "saved",
      shared: false,
      moduleName: id,
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
    await ChromeSyncStorage.saveScript(script);
    try {
      const editorSettings = await ChromeSyncStorage.getEditorSettings();
      await CompiledCodeStorage.saveCompiledCode(
        script.id,
        buildCompiledCodeEntry("", "", {
          minifyCompiledOutput: editorSettings.minifyCompiledOutput ?? false,
          sourceHash: hashUserscriptCompileSources(script),
        })
      );
    } catch (error) {
      console.warn(
        "Failed to seed compiled code for new userscript:",
        error
      );
    }
    return script;
  }
);

export const deleteUserscript = createAsyncThunk(
  "userscripts/deleteUserscript",
  async (scriptId: string) => {
    await ChromeSyncStorage.deleteScript(scriptId);
    await CompiledCodeStorage.deleteCompiledCode(scriptId);
    return scriptId;
  }
);

export const toggleUserscript = createAsyncThunk(
  "userscripts/toggleUserscript",
  async (scriptId: string) => {
    const scriptsMap = await ChromeSyncStorage.getAllScripts();
    const script = normalizeUserscript(scriptsMap[scriptId]);

    if (!script) {
      throw new Error(`Userscript not found: ${scriptId}`);
    }

    const updatedScript: Userscript = {
      ...script,
      enabled: !script.enabled,
    };

    await ChromeSyncStorage.saveScript(toStorageSafeUserscript(updatedScript));
    const applyResult = await sendSetEnabledMessage(
      scriptId,
      updatedScript.enabled
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
