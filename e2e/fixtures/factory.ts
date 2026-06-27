import type {
  Userscript,
  GlobalModule,
  EditorSettings,
} from "../../packages/shared/src/model";
import { sanitizeModuleName } from "../../packages/shared/src/model";
import { v4 as uuid } from "uuid";

export function buildUserscript(
  overrides: Partial<Userscript> = {}
): Userscript {
  const now = Date.now();
  const id = overrides.id ?? uuid();

  return {
    id,
    name: "Test Script",
    enabled: true,
    status: "saved",
    shared: true,
    moduleName: sanitizeModuleName("Test Script"),
    sharedScripts: [],
    globalModules: [],
    typeDefinitions: "",
    code: {
      source: {
        typescript: "",
        scss: "",
      },
      compiled: {
        javascript: "",
        css: "",
      },
    },
    urlPatterns: [],
    runAt: "afterPageLoad",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function buildGlobalModule(
  overrides: Partial<GlobalModule> = {}
): GlobalModule {
  return {
    id: uuid(),
    name: "Test Module",
    url: "https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js",
    enabled: true,
    ...overrides,
  };
}

export function buildEditorSettings(
  overrides: Partial<EditorSettings> = {}
): EditorSettings {
  return {
    theme: "invert-dark",
    appTheme: "graphite",
    fontSize: 11,
    tabSize: 2,
    autoFormat: true,
    minifyCompiledOutput: false,
    ...overrides,
  };
}
