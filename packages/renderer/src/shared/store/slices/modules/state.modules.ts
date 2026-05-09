import { GlobalModules } from "@shared/model";

export type ModulesState = {
  modules: GlobalModules;
  isLoaded: boolean;
};

export const initialState: ModulesState = {
  modules: {},
  isLoaded: false,
};
