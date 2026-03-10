import { configureStore } from "@reduxjs/toolkit";
import { createLogger } from "redux-logger";
import editorReducer from "./slices/monaco-editor";
import settingsReducer from "./slices/settings";
import userscriptsReducer from "./slices/userscripts";

const logger = createLogger({
  collapsed: true,
  diff: true,
});

export const store = configureStore({
  reducer: {
    userscripts: userscriptsReducer,
    settings: settingsReducer,
    editor: editorReducer,
  },
  devTools: {
    name: "Invert IDE Userscripts",
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
