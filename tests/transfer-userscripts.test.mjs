import assert from "node:assert/strict";
import test from "node:test";
import {
  getEffectiveTransferSharedImports,
  validateUserscriptsTransferFile,
} from "../packages/renderer/src/shared/store/slices/userscripts/transfer.userscripts.ts";

test("getEffectiveTransferSharedImports prefers imports derived from TypeScript source", () => {
  const effective = getEffectiveTransferSharedImports({
    sharedImports: ["stale-module"],
    sources: {
      typescript:
        'import { helper } from "scripts/runtime/main";\nexport const x = helper;',
      "typescript-declarations": "",
      scss: "",
    },
  });

  assert.deepEqual(effective, ["runtime"]);
});

test("getEffectiveTransferSharedImports falls back to explicit sharedImports", () => {
  const effective = getEffectiveTransferSharedImports({
    sharedImports: ["  utils ", "utils", "helpers"],
    sources: {
      typescript: "export const x = 1;",
      "typescript-declarations": "",
      scss: "",
    },
  });

  assert.deepEqual(effective, ["helpers", "utils"]);
});

test("validateUserscriptsTransferFile rejects non-object payloads", () => {
  const result = validateUserscriptsTransferFile([]);

  assert.deepEqual(result.errors, [
    "The selected file must contain a JSON object.",
  ]);
  assert.equal(result.file, undefined);
});

test("validateUserscriptsTransferFile rejects unknown shared imports", () => {
  const result = validateUserscriptsTransferFile({
    userscripts: [
      {
        name: "Consumer",
        moduleName: "consumer",
        sources: {
          typescript: 'import { helper } from "scripts/missing/main";',
        },
      },
    ],
  });

  assert.match(
    result.errors.join("\n"),
    /unknown shared module "missing"/i
  );
  assert.equal(result.file, undefined);
});

test("validateUserscriptsTransferFile rejects duplicate shared module names", () => {
  const result = validateUserscriptsTransferFile({
    userscripts: [
      {
        name: "Shared A",
        moduleName: "shared-util",
        sources: { typescript: "export const a = 1;" },
      },
      {
        name: "Shared B",
        moduleName: "shared-util",
        sources: { typescript: "export const b = 2;" },
      },
    ],
  });

  assert.match(
    result.errors.join("\n"),
    /shared module name "shared-util" appears more than once/i
  );
});

test("validateUserscriptsTransferFile accepts resolvable shared graphs", () => {
  const result = validateUserscriptsTransferFile({
    userscripts: [
      {
        name: "Shared",
        moduleName: "runtime",
        sources: { typescript: "export const helper = 1;" },
      },
      {
        name: "Consumer",
        moduleName: "consumer",
        sources: {
          typescript: 'import { helper } from "scripts/runtime/main";',
        },
        globalModuleImports: ["known-module"],
      },
    ],
  }, {
    globalModules: {
      "known-module": {
        id: "known-module",
        name: "Known",
        url: "https://example.com/mod.js",
        enabled: true,
      },
    },
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.missingGlobalModuleIds, []);
  assert.equal(result.file?.userscripts.length, 2);
});

test("validateUserscriptsTransferFile reports missing global modules without blocking file parse", () => {
  const result = validateUserscriptsTransferFile(
    {
      userscripts: [
        {
          name: "Needs CDN",
          moduleName: "needs-cdn",
          sources: { typescript: "export const x = 1;" },
          globalModuleImports: ["missing-cdn", "also-missing"],
        },
      ],
    },
    { globalModules: {} }
  );

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.missingGlobalModuleIds, [
    "also-missing",
    "missing-cdn",
  ]);
  assert.ok(result.file);
});

const transferEntry = (moduleName, typescript = "export const x = 1;", extra = {}) => ({
  name: moduleName || "Unnamed",
  moduleName,
  sources: { typescript },
  ...extra,
});

test("validateUserscriptsTransferFile rejects paths used by existing scripts", () => {
  const result = validateUserscriptsTransferFile(
    { userscripts: [transferEntry("My Lib")] },
    { existingSharedModuleNames: ["my-lib"] }
  );

  assert.match(result.errors.join("\n"), /module path "my-lib" is already used/i);
  assert.equal(result.file, undefined);
});

test("validateUserscriptsTransferFile still resolves imports of existing scripts", () => {
  const result = validateUserscriptsTransferFile(
    {
      userscripts: [
        transferEntry("consumer", 'import "scripts/my-lib/main";'),
      ],
    },
    { existingSharedModuleNames: ["My Lib"] }
  );

  assert.deepEqual(result.errors, []);
});

test("validateUserscriptsTransferFile resolves imports through sanitized paths", () => {
  const result = validateUserscriptsTransferFile({
    userscripts: [
      transferEntry("MyLib"),
      transferEntry("consumer", 'import { x } from "scripts/mylib/main";'),
      transferEntry("legacy", "export {};", { sharedImports: ["MyLib"] }),
    ],
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.file?.userscripts.length, 3);
});

test("validateUserscriptsTransferFile rejects a specifier that only resolves after sanitizing", () => {
  const result = validateUserscriptsTransferFile({
    userscripts: [
      transferEntry("MyLib"),
      transferEntry("consumer", 'import { x } from "scripts/MyLib/main";'),
    ],
  });

  assert.match(result.errors.join("\n"), /unknown shared module "MyLib"/);
});

test("validateUserscriptsTransferFile detects duplicates after sanitizing", () => {
  const result = validateUserscriptsTransferFile({
    userscripts: [transferEntry("My Lib"), transferEntry("my-lib")],
  });

  assert.match(
    result.errors.join("\n"),
    /shared module name "my-lib" appears more than once/i
  );
});

test("validateUserscriptsTransferFile ignores names that fall back to the script ID", () => {
  const result = validateUserscriptsTransferFile({
    userscripts: [transferEntry("---"), transferEntry("!!!")],
  });

  assert.deepEqual(result.errors, []);
});
