import { configureStore } from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";
import { createLogger } from "redux-logger";
import userscriptsReducer from "./slices/userscripts.slice";
import { rootEpic } from "./root-epic";
import { ReduxDevToolsPanel } from "../components/devtools/DevTools";

const epicMiddleware = createEpicMiddleware();

const logger = createLogger({
  collapsed: true,
  diff: true,
});

export const store = configureStore({
  reducer: {
    userscripts: userscriptsReducer,
  },
  devTools: {
    name: "Invert IDE Userscripts",
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(epicMiddleware, logger),
  enhancers: (getDefaultEnhancers) => getDefaultEnhancers().concat(ReduxDevToolsPanel.instrument()),
});

epicMiddleware.run(rootEpic);

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
