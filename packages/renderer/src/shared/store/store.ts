import { configureStore } from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";
import { createLogger } from "redux-logger";
import userscriptsReducer from "./slices/userscripts.slice";
import { rootEpic } from "./root-epic";

const epicMiddleware = createEpicMiddleware();

const logger = createLogger({
  collapsed: true,
});

export const store = configureStore({
  reducer: {
    userscripts: userscriptsReducer,
  },
  devTools: true, // We keep this true for standard detection if it ever works (e.g. in popups sometimes)
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(epicMiddleware).concat(logger),
});

epicMiddleware.run(rootEpic);

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
