import { configureStore } from "@reduxjs/toolkit";
import { createLogger } from "redux-logger";
import settingsReducer from "./slices/settings.slice";
import userscriptsReducer from "./slices/userscripts.slice";

const logger = createLogger({
  collapsed: true,
  diff: true,
});

export const store = configureStore({
  reducer: {
    userscripts: userscriptsReducer,
    settings: settingsReducer,
  },
  devTools: {
    name: "Invert IDE Userscripts",
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(logger),
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
