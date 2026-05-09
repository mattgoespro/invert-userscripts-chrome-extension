import { configureStore } from "@reduxjs/toolkit";
import { createLogger } from "redux-logger";
import editorReducer from "./slices/code-editor";
import modulesReducer from "./slices/modules";
import settingsReducer from "./slices/settings";
import userscriptsReducer from "./slices/userscripts";
import workspaceReducer from "./slices/workspace";

const nodeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  }
).process?.env?.NODE_ENV;
const isDevelopment = nodeEnv === undefined || nodeEnv === "development";

export const store = configureStore({
  reducer: {
    userscripts: userscriptsReducer,
    modules: modulesReducer,
    settings: settingsReducer,
    editor: editorReducer,
    workspace: workspaceReducer,
  },
  devTools: {
    name: "Invert IDE Userscripts",
  },
  middleware: (getDefaultMiddleware) => {
    const defaultMiddleware = getDefaultMiddleware();

    if (!isDevelopment) {
      return defaultMiddleware;
    }

    return defaultMiddleware.concat(
      createLogger({
        collapsed: true,
        diff: true,
      })
    );
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
