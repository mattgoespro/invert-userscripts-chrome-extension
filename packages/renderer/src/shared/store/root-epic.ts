import { combineEpics } from "redux-observable";
import { userscriptsEpics } from "./epics/userscripts.epics";

export const rootEpic = combineEpics(userscriptsEpics);
