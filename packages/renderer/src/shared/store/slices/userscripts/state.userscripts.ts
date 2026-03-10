import { Userscripts, Userscript } from "@shared/model";

export type UserscriptsState = {
  scripts?: Userscripts;
  currentUserscript?: Userscript;
};

export const initialState: UserscriptsState = {
  scripts: {},
};
