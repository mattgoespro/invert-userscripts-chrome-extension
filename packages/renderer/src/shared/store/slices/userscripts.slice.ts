import { createSlice, createAsyncThunk, createSelector, PayloadAction } from "@reduxjs/toolkit";
import { Userscript, UserscriptSourceLanguage, Userscripts } from "@shared/model";
import { StorageManager } from "@shared/storage";
import { TypeScriptCompiler, SassCompiler } from "@/sandbox/compiler";
import type { RootState } from "../store";
import { uuid } from "@/shared/utils";

export type UserscriptsState = {
  scripts?: Userscripts;
  currentUserscript?: Userscript;
};

const initialState: UserscriptsState = {
  scripts: {},
};

export const loadUserscripts = createAsyncThunk("userscripts/loadUserscripts", async () => {
  const scriptsMap = await StorageManager.getAllScripts();
  return Object.values(scriptsMap);
});

export const createUserscript = createAsyncThunk("userscripts/createUserscript", async () => {
  const timestamp = Date.now();
  const script: Userscript = {
    id: uuid(),
    name: "New Script",
    enabled: false,
    status: "modified",
    shared: false,
    moduleName: "",
    sharedScripts: [],
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
  await StorageManager.saveScript(script);
  return script;
});

export const deleteUserscript = createAsyncThunk(
  "userscripts/deleteUserscript",
  async (scriptId: string) => {
    await StorageManager.deleteScript(scriptId);
    return scriptId;
  }
);

export const toggleUserscript = createAsyncThunk(
  "userscripts/toggleUserscript",
  async (scriptId: string) => {
    const scriptsMap = await StorageManager.getAllScripts();
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

    await StorageManager.saveScript(storageScript);
    // Return full version with compiled code for Redux state
    return updatedScript;
  }
);

export const updateUserscript = createAsyncThunk<Userscript, Userscript, { state: RootState }>(
  "userscripts/updateUserscript",
  async (script: Userscript) => {
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
    await StorageManager.updateScript(script.id, storageScript);
    return script;
  }
);

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
    const scriptsMap = await StorageManager.getAllScripts();
    const script = scriptsMap[id];

    if (language === "typescript") {
      const compiled = TypeScriptCompiler.compile(code);

      if (!compiled.success) {
        throw new Error(`TypeScript compilation error: ${compiled.error?.message}`);
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

    await StorageManager.updateScript(id, {
      ...script,
      code: {
        source: script.code.source,
        compiled: {
          javascript: "",
          css: "",
        },
      },
    });

    return script;
  }
);

const userscriptsSlice = createSlice({
  name: "userscripts",
  initialState,
  selectors: {
    selectAllUserscripts(state: UserscriptsState) {
      return state.scripts;
    },
    selectCurrentUserscript(state: UserscriptsState) {
      return state.currentUserscript;
    },
    selectUserscriptById(state: UserscriptsState, scriptId: string) {
      return state.scripts[scriptId];
    },
    selectUnsavedUserscripts: createSelector(
      (state: UserscriptsState) => state.scripts,
      (scripts) => Object.values(scripts ?? {}).filter((script) => script.status === "modified")
    ),
    selectSharedUserscripts: createSelector(
      (state: UserscriptsState) => state.scripts,
      (scripts) => Object.values(scripts ?? {}).filter((script) => script.shared)
    ),
  },
  reducers: {
    setCurrentUserscript: {
      prepare: (id: string) => {
        return {
          payload: { id },
        };
      },
      reducer: (state, action: PayloadAction<{ id: string }>) => {
        state.currentUserscript = state.scripts[action.payload.id];
      },
    },
    markUserscriptModified: {
      prepare: (id: string) => {
        return {
          payload: { id },
        };
      },
      reducer: (state, action: PayloadAction<{ id: string }>) => {
        const script = state.scripts[action.payload.id];
        if (script && script.status !== "modified") {
          script.status = "modified";
          if (state.currentUserscript?.id === action.payload.id) {
            state.currentUserscript.status = "modified";
          }
        }
      },
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserscripts.fulfilled, (state, action) => {
        const scripts = action.payload.map((script) => ({ ...script, status: "saved" as const }));
        state.scripts = Object.fromEntries(scripts.map((script) => [script.id, script]));
      })
      .addCase(createUserscript.fulfilled, (state, action) => {
        state.scripts[action.payload.id] = action.payload;
      })
      .addCase(deleteUserscript.fulfilled, (state, action) => {
        const id = action.payload;

        state.scripts = Object.fromEntries(
          Object.entries(state.scripts).filter(([scriptId]) => scriptId !== id)
        );

        if (state.currentUserscript?.id === id) {
          state.currentUserscript = undefined;
        }
      })
      .addCase(toggleUserscript.fulfilled, (state, action) => {
        const updatedScript = action.payload;

        state.scripts[updatedScript.id] = updatedScript;
      })
      .addCase(updateUserscript.fulfilled, (state, action) => {
        const updatedScript = action.payload;

        state.scripts[updatedScript.id] = updatedScript;

        if (state.currentUserscript?.id === updatedScript.id) {
          state.currentUserscript = updatedScript;
        }
      })
      .addCase(updateUserscriptCode.fulfilled, (state, action) => {
        const updatedScript = action.payload;

        state.scripts[updatedScript.id] = updatedScript;

        if (state.currentUserscript?.id === updatedScript.id) {
          state.currentUserscript = updatedScript;
        }
      });
  },
});

export const { setCurrentUserscript, markUserscriptModified } = userscriptsSlice.actions;

export const {
  selectAllUserscripts,
  selectUserscriptById,
  selectCurrentUserscript,
  selectUnsavedUserscripts,
  selectSharedUserscripts,
} = userscriptsSlice.selectors;

export default userscriptsSlice.reducer;
