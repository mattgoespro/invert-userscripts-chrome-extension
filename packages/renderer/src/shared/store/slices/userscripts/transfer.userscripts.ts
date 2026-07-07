import { getSharedImportModuleNames } from "@shared/shared-module-imports";
import { GlobalModules, Userscript, Userscripts } from "@shared/model";

const TRANSFER_SCHEMA_URL = "https://json-schema.org/draft/2020-12/schema";
const TRANSFER_FILE_TITLE = "Userscripts";

type UserscriptImportSources = {
  typescript: string;
  "typescript-declarations": string;
  scss: string;
};

export type UserscriptImportEntry = {
  name: string;
  enabled: boolean;
  urlPatterns: string[];
  runAt: Userscript["runAt"];
  moduleName: string;
  sources: UserscriptImportSources;
  sharedImports: string[];
  globalModuleImports: string[];
};

export type UserscriptsTransferFile = {
  $schema?: string;
  title?: string;
  userscripts: UserscriptImportEntry[];
};

export type UserscriptsTransferValidationResult = {
  errors: string[];
  missingGlobalModuleIds: string[];
  file?: UserscriptsTransferFile;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(
  value: unknown,
  fieldPath: string,
  errors: string[],
  fallback = ""
): string {
  if (value == null) {
    return fallback;
  }

  if (typeof value !== "string") {
    errors.push(`${fieldPath} must be a string.`);
    return fallback;
  }

  return value;
}

function readOptionalBoolean(
  value: unknown,
  fieldPath: string,
  errors: string[],
  fallback = false
): boolean {
  if (value == null) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    errors.push(`${fieldPath} must be a boolean.`);
    return fallback;
  }

  return value;
}

function readOptionalStringArray(
  value: unknown,
  fieldPath: string,
  errors: string[]
): string[] {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push(`${fieldPath} must be an array of strings.`);
    return [];
  }

  const items: string[] = [];

  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") {
      errors.push(`${fieldPath}[${index}] must be a string.`);
      continue;
    }

    items.push(item);
  }

  return items;
}

function readRunAt(
  value: unknown,
  fieldPath: string,
  errors: string[]
): Userscript["runAt"] {
  if (value == null) {
    return "beforePageLoad";
  }

  if (value === "beforePageLoad" || value === "afterPageLoad") {
    return value;
  }

  errors.push(`${fieldPath} must be \"beforePageLoad\" or \"afterPageLoad\".`);
  return "beforePageLoad";
}

function normalizeUserscriptImportEntry(
  value: unknown,
  index: number,
  errors: string[]
): UserscriptImportEntry {
  const fieldPrefix = `userscripts[${index}]`;

  if (!isRecord(value)) {
    errors.push(`${fieldPrefix} must be an object.`);
    return {
      name: "",
      enabled: false,
      urlPatterns: [],
      runAt: "beforePageLoad",
      moduleName: "",
      sources: {
        typescript: "",
        "typescript-declarations": "",
        scss: "",
      },
      sharedImports: [],
      globalModuleImports: [],
    };
  }

  const name = readOptionalString(value.name, `${fieldPrefix}.name`, errors);
  if (!name.trim()) {
    errors.push(`${fieldPrefix}.name is required.`);
  }

  const sourcesValue = value.sources;
  if (sourcesValue != null && !isRecord(sourcesValue)) {
    errors.push(`${fieldPrefix}.sources must be an object.`);
  }

  const normalizedSources = isRecord(sourcesValue) ? sourcesValue : {};

  return {
    name,
    enabled: readOptionalBoolean(
      value.enabled,
      `${fieldPrefix}.enabled`,
      errors
    ),
    urlPatterns: readOptionalStringArray(
      value.urlPatterns,
      `${fieldPrefix}.urlPatterns`,
      errors
    ),
    runAt: readRunAt(value.runAt, `${fieldPrefix}.runAt`, errors),
    moduleName: readOptionalString(
      value.moduleName,
      `${fieldPrefix}.moduleName`,
      errors
    ),
    sources: {
      typescript: readOptionalString(
        normalizedSources.typescript,
        `${fieldPrefix}.sources.typescript`,
        errors
      ),
      "typescript-declarations": readOptionalString(
        normalizedSources["typescript-declarations"],
        `${fieldPrefix}.sources.typescript-declarations`,
        errors
      ),
      scss: readOptionalString(
        normalizedSources.scss,
        `${fieldPrefix}.sources.scss`,
        errors
      ),
    },
    sharedImports: readOptionalStringArray(
      value.sharedImports,
      `${fieldPrefix}.sharedImports`,
      errors
    ),
    globalModuleImports: readOptionalStringArray(
      value.globalModuleImports,
      `${fieldPrefix}.globalModuleImports`,
      errors
    ),
  };
}

function dedupeAndSort(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function getEffectiveTransferSharedImports(
  entry: Pick<UserscriptImportEntry, "sharedImports" | "sources">
): string[] {
  const derivedImports = getSharedImportModuleNames(entry.sources.typescript);

  if (derivedImports.length > 0) {
    return dedupeAndSort(derivedImports);
  }

  return dedupeAndSort(
    entry.sharedImports.map((moduleName) => moduleName.trim())
  );
}

function getImportedSharedModuleNames(
  file: UserscriptsTransferFile
): Set<string> {
  return new Set(
    file.userscripts
      .map((script) => script.moduleName.trim())
      .filter((moduleName) => moduleName.length > 0)
  );
}

export function validateUserscriptsTransferFile(
  value: unknown,
  options?: {
    globalModules?: GlobalModules;
    existingSharedModuleNames?: Iterable<string>;
  }
): UserscriptsTransferValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return {
      errors: ["The selected file must contain a JSON object."],
      missingGlobalModuleIds: [],
    };
  }

  const userscriptsValue = value.userscripts;
  if (!Array.isArray(userscriptsValue)) {
    return {
      errors: ["The selected file must contain a userscripts array."],
      missingGlobalModuleIds: [],
    };
  }

  const file: UserscriptsTransferFile = {
    $schema:
      typeof value.$schema === "string" ? value.$schema : TRANSFER_SCHEMA_URL,
    title: typeof value.title === "string" ? value.title : TRANSFER_FILE_TITLE,
    userscripts: userscriptsValue.map((entry, index) =>
      normalizeUserscriptImportEntry(entry, index, errors)
    ),
  };

  const duplicateModuleNames = new Set<string>();
  const importedModuleNames = new Set<string>();

  for (const script of file.userscripts) {
    const moduleName = script.moduleName.trim();

    if (!moduleName) {
      continue;
    }

    if (importedModuleNames.has(moduleName)) {
      duplicateModuleNames.add(moduleName);
      continue;
    }

    importedModuleNames.add(moduleName);
  }

  for (const moduleName of duplicateModuleNames) {
    errors.push(
      `Shared module name \"${moduleName}\" appears more than once in the imported file.`
    );
  }

  const resolvableSharedModuleNames = new Set([
    ...getImportedSharedModuleNames(file),
    ...(options?.existingSharedModuleNames ?? []),
  ]);

  for (const script of file.userscripts) {
    for (const sharedImport of getEffectiveTransferSharedImports(script)) {
      if (resolvableSharedModuleNames.has(sharedImport)) {
        continue;
      }

      errors.push(
        `Script \"${script.name}\" references unknown shared module \"${sharedImport}\".`
      );
    }
  }

  const missingGlobalModuleIds = options?.globalModules
    ? dedupeAndSort(
        file.userscripts.flatMap((script) =>
          script.globalModuleImports.filter(
            (moduleId) => options.globalModules[moduleId] == null
          )
        )
      )
    : [];

  return {
    errors: dedupeAndSort(errors),
    missingGlobalModuleIds,
    file: errors.length === 0 ? file : undefined,
  };
}

export function buildUserscriptsTransferFile(
  scriptsMap: Userscripts
): UserscriptsTransferFile {
  const scripts = Object.values(scriptsMap).sort(
    (left, right) => left.createdAt - right.createdAt
  );

  return {
    $schema: TRANSFER_SCHEMA_URL,
    title: TRANSFER_FILE_TITLE,
    userscripts: scripts.map((script) => ({
      name: script.name,
      enabled: script.enabled,
      urlPatterns: [...(script.urlPatterns ?? [])],
      runAt: script.runAt,
      moduleName: script.moduleName,
      sources: {
        typescript: script.code.source.typescript,
        "typescript-declarations": script.typeDefinitions,
        scss: script.code.source.scss,
      },
      sharedImports: getSharedImportModuleNames(script.code.source.typescript),
      globalModuleImports: [...(script.globalModules ?? [])],
    })),
  };
}

export function stringifyUserscriptsTransferFile(
  file: UserscriptsTransferFile
): string {
  return JSON.stringify(file, null, 2);
}
