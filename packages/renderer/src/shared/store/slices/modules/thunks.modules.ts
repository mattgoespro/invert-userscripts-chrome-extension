import { createAsyncThunk } from "@reduxjs/toolkit/react";
import { GlobalModule } from "@shared/model";
import { ChromeSyncStorage } from "@shared/storage";

export const loadModules = createAsyncThunk("modules/loadModules", async () => {
  return ChromeSyncStorage.getAllModules();
});

export const addModule = createAsyncThunk(
  "modules/addModule",
  async (module: GlobalModule) => {
    await ChromeSyncStorage.saveModule(module);
    return module;
  }
);

export const updateModule = createAsyncThunk(
  "modules/updateModule",
  async (module: GlobalModule) => {
    await ChromeSyncStorage.saveModule(module);
    return module;
  }
);

export const deleteModule = createAsyncThunk(
  "modules/deleteModule",
  async (moduleId: string) => {
    await ChromeSyncStorage.deleteModule(moduleId);
    return moduleId;
  }
);
