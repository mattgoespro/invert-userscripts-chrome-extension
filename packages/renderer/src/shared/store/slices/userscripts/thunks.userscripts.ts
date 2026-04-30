import {
  buildCompiledCodeEntry,
  buildUserscriptJavascript,
  buildUserscriptStylesheet,
  getCompiledOutputBuildOptions,
  isCompiledCodeBuildCurrent,
} from "@/sandbox/compiler";
import { createAsyncThunk } from "@reduxjs/toolkit/react";
import {
  CompiledCodeEntry,
  Userscript,
  UserscriptSourceLanguage,
} from "@shared/model";
import type { RuntimePortMessageEvent } from "@shared/messages";
import { ChromeSyncStorage, CompiledCodeStorage } from "@shared/storage";
import { RootState } from "../../store";
import { uuid } from "@/shared/utils";

function normalizeUserscript(script: Userscript): Userscript {
  return {
    ...script,
    typeDefinitions: script.typeDefinitions ?? "",
  };
}

function buildStorageSafeScript(script: Userscript): Userscript {
  return {
    ...script,
    code: {
      source: script.code.source,
      compiled: {
        javascript: "",
        css: "",
      },
    },
  };
}

function getBuildOptions(state: RootState) {
  return getCompiledOutputBuildOptions(state.settings.editorSettings);
}

function hasSharedJavascriptConfigChanged(
  nextScript: Userscript,
  previousScript?: Userscript
): boolean {
  if (!previousScript) {
    return true;
  }

  const nextSharedScripts = nextScript.sharedScripts ?? [];
  const previousSharedScripts = previousScript.sharedScripts ?? [];

  if (
    nextScript.shared !== previousScript.shared ||
    nextScript.moduleName !== previousScript.moduleName ||
    nextSharedScripts.length !== previousSharedScripts.length
  ) {
    return true;
  }

  return nextSharedScripts.some(
    (sharedScriptId, index) => sharedScriptId !== previousSharedScripts[index]
  );
}

async function compileJavascriptOrThrow(
  script: Userscript,
  state: RootState
): Promise<string> {
  const result = await buildUserscriptJavascript(
    script,
    script.code.source.typescript,
    getBuildOptions(state)
  );

  if (!result.success) {
    throw new Error(
      `TypeScript compilation error: ${result.error?.message ?? "Unknown error"}`
    );
  }

  return result.code ?? "";
}

async function compileStylesheetOrThrow(
  script: Userscript,
  state: RootState
): Promise<string> {
  const result = await buildUserscriptStylesheet(
    script.code.source.scss,
    getBuildOptions(state)
  );

  if (!result.success) {
    throw new Error(
      `SCSS compilation error: ${result.error?.message ?? "Unknown error"}`
    );
  }

  return result.code ?? "";
}

async function compileAllOutputsOrThrow(
  script: Userscript,
  state: RootState
): Promise<CompiledCodeEntry> {
  const [javascript, css] = await Promise.all([
    compileJavascriptOrThrow(script, state),
    compileStylesheetOrThrow(script, state),
  ]);

  return buildCompiledCodeEntry(javascript, css, getBuildOptions(state));
}

function mergeCompiledCode(
  script: Userscript,
  compiled?: CompiledCodeEntry | null
): Userscript {
  if (!compiled) {
    return script;
  }

  return {
    ...script,
    code: {
      ...script.code,
      compiled: {
        javascript: compiled.javascript || script.code.compiled.javascript,
        css: compiled.css || script.code.compiled.css,
      },
    },
  };
}

function sendRefreshTabsMessage() {
  const message: RuntimePortMessageEvent<"refreshTabs"> = {
    source: "options",
    type: "refreshTabs",
  };

  chrome.runtime.sendMessage(message).catch((error) => {
    console.warn("Failed to send refreshTabs message:", error);
  });
}

export const loadUserscripts = createAsyncThunk(
  "userscripts/loadUserscripts",
  async () => {
    const [scriptsMap, compiledCodeMap] = await Promise.all([
      ChromeSyncStorage.getAllScripts(),
      CompiledCodeStorage.getAllCompiledCode(),
    ]);

    return Object.values(scriptsMap).map((script) =>
      mergeCompiledCode(normalizeUserscript(script), compiledCodeMap[script.id])
    );
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
    const script = normalizeUserscript(scriptsMap[scriptId]);

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
>("userscripts/updateUserscript", async (script: Userscript, { getState }) => {
  const normalizedScript = normalizeUserscript(script);
  const previousScriptsMap = await ChromeSyncStorage.getAllScripts();
  const previousScript = previousScriptsMap[normalizedScript.id]
    ? normalizeUserscript(previousScriptsMap[normalizedScript.id])
    : undefined;
  const compiledEntry = await CompiledCodeStorage.getCompiledCode(
    normalizedScript.id
  );
  const state = getState();
  const storageScript = buildStorageSafeScript(normalizedScript);

  if (!isCompiledCodeBuildCurrent(compiledEntry, getBuildOptions(state))) {
    const rebuiltEntry = await compileAllOutputsOrThrow(
      normalizedScript,
      state
    );

    normalizedScript.code.compiled.javascript = rebuiltEntry.javascript;
    normalizedScript.code.compiled.css = rebuiltEntry.css;

    await CompiledCodeStorage.saveCompiledCode(
      normalizedScript.id,
      rebuiltEntry
    );
  } else if (
    hasSharedJavascriptConfigChanged(normalizedScript, previousScript)
  ) {
    const javascript = await compileJavascriptOrThrow(normalizedScript, state);
    const css = compiledEntry?.css ?? normalizedScript.code.compiled.css;
    const rebuiltEntry = buildCompiledCodeEntry(
      javascript,
      css,
      getBuildOptions(state)
    );

    normalizedScript.code.compiled.javascript = javascript;
    normalizedScript.code.compiled.css = css;

    await CompiledCodeStorage.saveCompiledCode(
      normalizedScript.id,
      rebuiltEntry
    );
  }

  await ChromeSyncStorage.updateScript(normalizedScript.id, storageScript);

  return normalizedScript;
});

export const updateUserscriptTypeDefinitions = createAsyncThunk(
  "userscripts/updateUserscriptTypeDefinitions",
  async ({ id, typeDefinitions }: { id: string; typeDefinitions: string }) => {
    const scriptsMap = await ChromeSyncStorage.getAllScripts();
    const script = normalizeUserscript(scriptsMap[id]);

    script.typeDefinitions = typeDefinitions;
    script.status = "saved";
    script.updatedAt = Date.now();

    await ChromeSyncStorage.updateScript(id, buildStorageSafeScript(script));

    return script;
  }
);

export const updateUserscriptCode = createAsyncThunk<
  Userscript,
  {
    id: string;
    language: UserscriptSourceLanguage;
    code: string;
  },
  { state: RootState }
>(
  "userscripts/updateUserscriptCode",
  async ({ id, language, code }, { getState }) => {
    const scriptsMap = await ChromeSyncStorage.getAllScripts();
    const script = normalizeUserscript(scriptsMap[id]);

    if (language === "typescript") {
      script.code.source.typescript = code;
    } else if (language === "scss") {
      script.code.source.scss = code;
    }

    const compiledEntry = await compileAllOutputsOrThrow(script, getState());

    script.code.compiled.javascript = compiledEntry.javascript;
    script.code.compiled.css = compiledEntry.css;

    script.status = "saved";
    script.updatedAt = Date.now();

    await ChromeSyncStorage.updateScript(id, buildStorageSafeScript(script));
    await CompiledCodeStorage.saveCompiledCode(id, compiledEntry);

    return script;
  }
);

/**
 * Rebuilds compiled userscript code when local artifacts are missing, outdated,
 * or when the caller explicitly requests a full rebuild.
 */
export const rebuildCompiledUserscripts = createAsyncThunk<
  Userscript[],
  { scope?: "stale" | "all" } | undefined,
  { state: RootState }
>("userscripts/rebuildCompiledUserscripts", async (args, { getState }) => {
  const [scriptsMap, compiledCodeMap] = await Promise.all([
    ChromeSyncStorage.getAllScripts(),
    CompiledCodeStorage.getAllCompiledCode(),
  ]);
  const scope = args?.scope ?? "stale";
  const state = getState();
  const buildOptions = getBuildOptions(state);
  const scripts = Object.values(scriptsMap).map(normalizeUserscript);
  const scriptsToRebuild = scripts.filter((script) => {
    if (scope === "all") {
      return true;
    }

    return !isCompiledCodeBuildCurrent(
      compiledCodeMap[script.id],
      buildOptions
    );
  });

  if (scriptsToRebuild.length === 0) {
    return [];
  }

  const rebuiltScripts: Userscript[] = [];

  for (const script of scriptsToRebuild) {
    const compiledEntry = await compileAllOutputsOrThrow(script, state);
    const updatedScript = mergeCompiledCode(script, compiledEntry);

    await CompiledCodeStorage.saveCompiledCode(script.id, compiledEntry);
    rebuiltScripts.push(updatedScript);
  }

  sendRefreshTabsMessage();

  return rebuiltScripts;
});
