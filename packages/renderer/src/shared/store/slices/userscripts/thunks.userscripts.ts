import { SassCompiler, TypeScriptCompiler } from "@/sandbox/compiler";
import { createAsyncThunk } from "@reduxjs/toolkit/react";
import { Userscript, UserscriptSourceLanguage } from "@shared/model";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import { RootState } from "../../store";
import { uuid } from "@/shared/utils";

export const loadUserscripts = createAsyncThunk(
  "userscripts/loadUserscripts",
  async () => {
    const scriptsMap = await ChromeSyncStorage.getAllScripts();
    return Object.values(scriptsMap);
  }
);

export const createUserscript = createAsyncThunk(
  "userscripts/createUserscript",
  async () => {
    const timestamp = Date.now();
    const script: Userscript = {
      id: uuid(),
      name: "New Script",
      enabled: false,
      status: "modified",
      shared: false,
      moduleName: "",
      sharedScripts: [],
      globalModules: [],
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
      urlPatterns: [],
      runAt: "beforePageLoad",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await ChromeSyncStorage.saveScript(script);
    await CompiledCodeStorage.saveCompiledCode(script.id, {
      javascript: "",
      css: "",
    });
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
    const script = scriptsMap[scriptId];

    if (!script) {
      throw new Error(`Userscript not found: ${scriptId}`);
    }

    const updatedScript: Userscript = {
      ...script,
      enabled: !script.enabled,
    };

    // Save storage-safe version without compiled code to preserve quota
    const storageScript: Userscript = {
      ...updatedScript,
      code: {
        source: updatedScript.code.source,
        compiled: {
          javascript: "",
          css: "",
        },
      },
    };

    await ChromeSyncStorage.saveScript(storageScript);
    // Return full version with compiled code for Redux state
    return updatedScript;
  }
);

export const updateUserscript = createAsyncThunk<
  Userscript,
  Userscript,
  { state: RootState }
>("userscripts/updateUserscript", async (script: Userscript) => {
  // Save storage-safe version without compiled code to preserve quota
  const storageScript: Userscript = {
    ...script,
    code: {
      source: script.code.source,
      compiled: {
        javascript: "",
        css: "",
      },
    },
  };
  await ChromeSyncStorage.updateScript(script.id, storageScript);
  await CompiledCodeStorage.saveCompiledCode(script.id, {
    javascript: script.code.compiled.javascript,
    css: script.code.compiled.css,
  });
  return script;
});

export const updateUserscriptCode = createAsyncThunk(
  "userscripts/updateUserscriptCode",
  async ({
    id,
    language,
    code,
  }: {
    id: string;
    language: UserscriptSourceLanguage;
    code: string;
  }) => {
    const scriptsMap = await ChromeSyncStorage.getAllScripts();
    const script = scriptsMap[id];

    if (language === "typescript") {
      const compiled = TypeScriptCompiler.compile(code);

      if (!compiled.success) {
        throw new Error(
          `TypeScript compilation error: ${compiled.error?.message}`
        );
      }

      script.code.source.typescript = code;
      script.code.compiled.javascript = compiled.code ?? "";
    } else if (language === "scss") {
      const compiled = await SassCompiler.compile(code);

      if (!compiled.success) {
        throw new Error(`SCSS compilation error: ${compiled.error?.message}`);
      }

      script.code.source.scss = code;
      script.code.compiled.css = compiled.code ?? "";
    }

    script.status = "saved";
    script.updatedAt = Date.now();

    await ChromeSyncStorage.updateScript(id, script);
    await CompiledCodeStorage.saveCompiledCode(id, {
      javascript: script.code.compiled.javascript,
      css: script.code.compiled.css,
    });

    return script;
  }
);
