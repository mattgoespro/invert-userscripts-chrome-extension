import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  stringifyUserscriptsTransferFile,
  validateUserscriptsTransferFile,
  type UserscriptImportEntry,
  type UserscriptsTransferFile,
} from "../packages/renderer/src/shared/store/slices/userscripts/transfer.userscripts";
import { getSharedImportModuleNames } from "../packages/shared/src/shared-module-imports";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceDirectory = path.join(repositoryRoot, "examples/userscripts");
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repositoryRoot, "temp/example-userscripts.json");

async function exportExampleUserscripts(): Promise<void> {
  const entries = new Map<string, UserscriptImportEntry>();
  const files = await readdir(sourceDirectory, { withFileTypes: true });

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

    const contents = await readFile(
      path.join(sourceDirectory, file.name),
      "utf8"
    );

    if (isDeclaration) {
      const declarations = entry.sources["typescript-declarations"];
      entry.sources["typescript-declarations"] = declarations
        ? `${declarations}\n${contents}`
        : contents;
    } else {
      entry.sources.typescript = contents;
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

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${stringifyUserscriptsTransferFile(validation.file)}\n`,
    "utf8"
  );
  console.log(`Exported ${entries.size} userscripts to ${outputPath}`);
}

exportExampleUserscripts().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
