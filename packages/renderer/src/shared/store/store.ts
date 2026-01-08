import { configureStore } from "@reduxjs/toolkit";
import { createEpicMiddleware } from "redux-observable";
import userscriptsReducer from "./slices/userscripts.slice";
import { rootEpic } from "./root-epic";

const epicMiddleware = createEpicMiddleware();

export const store = configureStore({
  reducer: {
    userscripts: userscriptsReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(epicMiddleware),
});

epicMiddleware.run(rootEpic);

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
