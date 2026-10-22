import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import {
  stringifyUserscriptsTransferFile,
  validateUserscriptsTransferFile,
  type UserscriptImportEntry,
  type UserscriptsTransferFile,
} from "../packages/renderer/src/shared/store/slices/userscripts/transfer.userscripts.js";
import { getSharedImportModuleNames } from "../packages/shared/src/shared-module-imports.js";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceDirectory = path.join(repositoryRoot, "examples/userscripts");
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repositoryRoot, "temp/example-userscripts.json");

async function exportExampleUserscripts(): Promise<void> {
  const entries = new Map<string, UserscriptImportEntry>();
  const files = fs.readdirSync(sourceDirectory, { withFileTypes: true });

  for (const file of files.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    if (!file.isFile() || !file.name.endsWith(".ts")) {
      continue;
    }

    const isDeclaration = file.name.endsWith(".d.ts");
    const name = file.name.replace(
      isDeclaration ? /(?:\.global)?\.d\.ts$/ : /\.ts$/,
      ""
    );
    let entry = entries.get(name);

    if (!entry) {
      entry = {
        name,
        enabled: false,
        urlPatterns: [],
        runAt: "afterPageLoad",
        moduleName: name,
        sources: {
          typescript: "",
          "typescript-declarations": "",
          scss: "",
        },
        sharedImports: [],
        globalModuleImports: [],
      };
      entries.set(name, entry);
    }

    const contents = fs.readFileSync(
      path.join(sourceDirectory, file.name),
      "utf8"
    );
    // remove `declare global {` and `} from the contents if they exist
    let cleanedContents = contents.replace(
      /^declare global {[\s\S]*?}\n?$/,
      ""
    );

    // remove eslint directives from the contents if they exist
    cleanedContents = cleanedContents.replace(
      /^\/\/ eslint-disable-next-line[\s\S]*?\n?$/,
      ""
    );

    if (isDeclaration) {
      const declarations = entry.sources["typescript-declarations"];
      entry.sources["typescript-declarations"] = declarations
        ? `${declarations}\n${cleanedContents}`
        : cleanedContents;
    } else {
      entry.sources.typescript = cleanedContents;
      entry.sharedImports = getSharedImportModuleNames(contents);
    }
  }

  const transferFile: UserscriptsTransferFile = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Userscripts",
    userscripts: [...entries.values()],
  };
  const validation = validateUserscriptsTransferFile(transferFile);

  if (!validation.file) {
    throw new Error(validation.errors.join("\n"));
  }

  fs.ensureDirSync(path.dirname(outputPath));
  fs.writeFileSync(
    outputPath,
    `${stringifyUserscriptsTransferFile(validation.file)}\n`,
    "utf8"
  );
  console.log(`Exported ${entries.size} userscripts to ${outputPath}`);
}

try {
  exportExampleUserscripts();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
