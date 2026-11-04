import fs from "fs-extra";
import path from "path";
import * as sass from "sass";
import ts from "typescript";
import { fileURLToPath } from "url";

/** The backup version that the User JavaScript and CSS extension reads. */
const UJS_BACKUP_VERSION = 11;

interface UjsLibrary {
  id: string;
  name: string;
  src: string;
  type: "js";
}

interface UjsRule {
  id: string;
  name: string;
  urls: string;
  libs: string[];
  flags: string[];
  created: number;
  updated: number;
}

interface UjsRuleContent {
  js: string;
  jsDraft: string;
  scss: string;
  scssDraft: string;
  css: string;
  cssError: string;
  isCssCompiled: boolean;
  styleImportant: boolean;
}

interface UjsBackup {
  info: {
    version: number;
    updatedAt: number;
    lastEmitterId: string;
    isFullReplace: boolean;
  };
  libs: UjsLibrary[];
  rules: UjsRule[];
  [ruleId: `r:${string}`]: UjsRuleContent;
}

interface ExampleRuleSettings {
  flags: string[];
  /** Other example filename stems, or keys of `EXTERNAL_LIBRARIES`, in load order. */
  libs: string[];
}

/**
 * These IDs match the libraries in an existing UJS install, so a merge import
 * reuses their downloaded content.
 */
const EXTERNAL_LIBRARIES: Record<string, UjsLibrary> = {
  rxjs: {
    id: "m:1o0EQ8H89gFk1jd53aM0U",
    name: "rxjs",
    src: "https://unpkg.com/rxjs@7.8.1/dist/bundles/rxjs.umd.min.js",
    type: "js",
  },
  webfontloader: {
    id: "m:GBeeRAHEllS6_YPiGLEKR",
    name: "webfontloader",
    src: "https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js",
    type: "js",
  },
};

const DEFAULT_RULE_SETTINGS: ExampleRuleSettings = {
  flags: ["shared"],
  libs: [],
};

/** Run settings that can't be read from the source files themselves. */
const RULE_SETTINGS: Record<string, ExampleRuleSettings> = {
  logger: {
    flags: ["shared", "deepJS", "atStartJS"],
    libs: ["pretty-stringify"],
  },
  "dom-utils": {
    flags: ["shared", "deepJS", "atStartJS", "isoCSS"],
    libs: ["logger", "rxjs", "webfontloader"],
  },
  "view-video-source-common": {
    flags: ["shared", "deepJS", "atStartJS", "isoJS"],
    libs: ["logger"],
  },
  "view-video-source-embedded": {
    flags: ["shared", "isoJS"],
    libs: ["view-video-source-common"],
  },
  "view-video-source-main": {
    flags: ["isoJS"],
    libs: [
      "logger",
      "view-video-source-common",
      "dom-utils",
      "toasts",
      "button",
      "webfontloader",
      "dom-frame-detection",
      "material-icons",
    ],
  },
};

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceDirectory = path.join(repositoryRoot, "examples/userscripts");
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(repositoryRoot, "temp/example-userscripts.json");

/**
 * IDs stay the same between exports, so importing again updates these rules
 * instead of duplicating them, and a merge import leaves other rules alone.
 */
function getRuleId(name: string): `r:${string}` {
  return `r:example-${name}`;
}

function compileTypeScript(fileName: string, source: string): string {
  const { outputText, diagnostics } = ts.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
    },
  });

  if (diagnostics?.length) {
    throw new Error(
      `${fileName}: ${ts.formatDiagnostics(diagnostics, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => sourceDirectory,
        getNewLine: () => "\n",
      })}`
    );
  }

  return outputText.replace(/^\/\* eslint-(?:disable|enable).*\*\/\r?\n/gm, "");
}

function resolveRuleLibs(
  name: string,
  libs: string[],
  exampleNames: Set<string>
): string[] {
  return libs.map((lib) => {
    if (exampleNames.has(lib)) {
      return getRuleId(lib);
    }

    if (EXTERNAL_LIBRARIES[lib]) {
      return EXTERNAL_LIBRARIES[lib].id;
    }

    throw new Error(`${name}: unknown library "${lib}"`);
  });
}

function exportExampleUserscripts(): void {
  const exampleNames = new Set(
    fs
      .readdirSync(sourceDirectory)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
      .map((file) => file.replace(/\.ts$/, ""))
      .sort((left, right) => left.localeCompare(right))
  );
  const now = Date.now();
  const backup: UjsBackup = {
    info: {
      version: UJS_BACKUP_VERSION,
      updatedAt: now,
      lastEmitterId: "invert-example-export",
      isFullReplace: false,
    },
    libs: Object.values(EXTERNAL_LIBRARIES),
    rules: [],
  };

  for (const name of exampleNames) {
    const fileName = `${name}.ts`;
    const typescript = fs.readFileSync(
      path.join(sourceDirectory, fileName),
      "utf8"
    );
    const scssPath = path.join(sourceDirectory, `${name}.scss`);
    const scss = fs.existsSync(scssPath)
      ? fs.readFileSync(scssPath, "utf8")
      : "";
    const settings = RULE_SETTINGS[name] ?? DEFAULT_RULE_SETTINGS;
    const id = getRuleId(name);

    backup.rules.push({
      id,
      name,
      urls: "",
      libs: resolveRuleLibs(name, settings.libs, exampleNames),
      // Disabled rules still load when another rule depends on them.
      flags: [...settings.flags, "off"],
      created: now,
      updated: now,
    });
    backup[id] = {
      js: compileTypeScript(fileName, typescript),
      jsDraft: "",
      scss,
      scssDraft: "",
      css: scss ? sass.compileString(scss).css : "",
      cssError: "",
      isCssCompiled: scss !== "",
      styleImportant: false,
    };
  }

  fs.ensureDirSync(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(backup)}\n`, "utf8");
  console.log(`Exported ${backup.rules.length} userscripts to ${outputPath}`);
}

try {
  exportExampleUserscripts();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
