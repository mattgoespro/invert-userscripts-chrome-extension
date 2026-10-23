import type { EditorThemeSetting } from "./editor-theme";
import type { ModuleManifest } from "./modules/manifest";

export type AppThemeName =
  | "cyanotype"
  | "print"
  | "graphite"
  | "graphite-warm"
  | "graphite-dusk"
  | "graphite-ember"
  | "obsidian"
  | "obsidian-deep"
  | "obsidian-ember"
  | "obsidian-frost";

export type UserscriptStatus = "modified" | "saved";

export type UserscriptSourceLanguage = "typescript" | "scss";

export type UserscriptCompiledLanguage = "javascript" | "css";

export interface Userscript {
  /** Local repository revision; omitted from portable legacy serialization. */
  storageRevision?: string;
  id: string;
  name: string;
  enabled: boolean;
  status: UserscriptStatus;
  error?: boolean;
  shared: boolean;
  moduleName: string;
  sharedScripts: string[];
  globalModules: string[];
  typeDefinitions: string;
  code: {
    source: {
      [key in UserscriptSourceLanguage]: string;
    };
    compiled: {
      [key in UserscriptCompiledLanguage]: string;
    };
  };
  urlPatterns: string[];
  runAt: "beforePageLoad" | "afterPageLoad";
  createdAt: number;
  updatedAt: number;
}

export type Userscripts = Record<string, Userscript>;

export type GlobalModules = Record<string, GlobalModule>;

export interface GlobalModule {
  typeVersion?: string;
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  packageName?: string;
}

export interface EditorSettings {
  theme?: EditorThemeSetting;
  appTheme?: AppThemeName;
  fontSize?: number;
  tabSize?: number;
  autoFormat?: boolean;
  errorLens?: boolean;
  minifyCompiledOutput?: boolean;
}

export interface UserscriptCompileResult {
  manifest?: ModuleManifest;
  success: boolean;
  code?: string;
  error?: Error;
}

/**
 * Compiled code stored separately in Chrome local storage.
 */
export interface CompiledCodeBuildMetadata {
  compilerContractVersion?: number;
  sourceDigest?: string;
  version: 1;
  minifyCompiledOutput: boolean;
  /** Hash of the TypeScript/SCSS/shared identity that produced this artifact. */
  sourceHash?: string;
}

export interface CompiledCodeEntry {
  manifest?: ModuleManifest;
  javascript: string;
  css: string;
  build?: CompiledCodeBuildMetadata;
}

export interface SharedScriptInfo {
  id: string;
  name: string;
  moduleName: string;
  sourceCode: string;
  typeDefinitions: string;
}

/**
 * Sanitizes a userscript name into a valid kebab-case module name.
 * Lowercases, replaces non-alphanumeric character runs with a single hyphen,
 * and trims leading/trailing hyphens.
 */
export function sanitizeModuleName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Resolves the module path segment used in `scripts/<path>/main|types` import
 * specifiers and Monaco model URIs. Falls back to the script ID when metadata
 * is empty or sanitizes to nothing.
 */
export function getScriptModulePath(script: {
  id: string;
  moduleName?: string;
}): string {
  return sanitizeModuleName(script.moduleName?.trim() ?? "") || script.id;
}

/**
 * Another script already owns this Monaco / import path
 * (`scripts/<path>/main`). Callers must reject the write so two editors cannot
 * share one model URI.
 */
export function findDuplicateModulePathScript(
  scripts: Iterable<Pick<Userscript, "id" | "moduleName" | "name">>,
  candidate: { id: string; moduleName?: string }
): Pick<Userscript, "id" | "moduleName" | "name"> | undefined {
  const path = getScriptModulePath(candidate);

  for (const script of scripts) {
    if (script.id === candidate.id) {
      continue;
    }

    if (getScriptModulePath(script) === path) {
      return script;
    }
  }

  return undefined;
}
