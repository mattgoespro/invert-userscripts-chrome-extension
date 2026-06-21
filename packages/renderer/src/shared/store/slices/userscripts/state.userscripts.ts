import { Userscripts, Userscript } from "@shared/model";

export const DefaultNewUserscriptName = "New Script";

export type UserscriptsState = {
  scripts?: Userscripts;
  currentUserscript?: Userscript;
};

export const initialState: UserscriptsState = {
  scripts: {},
};
