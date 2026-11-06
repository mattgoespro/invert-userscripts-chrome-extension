import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function harness(syncCdnModuleLibs) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL(
          "../packages/monaco/src/typescript/language-service.ts",
          import.meta.url
        ),
        "utf8"
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }
    ).outputText,
    {
      exports,
      DOMException,
      Error,
      console: { warn: () => {} },
      require: (name) =>
        name === "./cdn-types"
          ? { syncCdnModuleLibs }
          : {
              syncWorkspaceModels: () => {},
              syncModulePackageJsons: () => {},
              syncAmbientTypeDefinitionLibs: () => {},
              refreshTypescriptDiagnosticsIfProgramFilesChanged: () => {},
            },
    }
  );
  return exports;
}

const projection = (cdnModules) => ({
  files: [],
  modulePaths: [],
  cdnModules,
});
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("a failed acquisition is not retried by reconciles until an explicit retry", async () => {
  let calls = 0;
  let fail = true;
  const service = harness(async () => {
    calls++;
    if (fail) {
      throw new Error("offline");
    }
  });
  const modules = [{ id: "m", packageName: "m" }];

  service.reconcileLanguageWorkspace(projection(modules));
  await settle();
  assert.equal(calls, 1);
  assert.equal(service.getLanguageAcquisitionError(), "offline");

  service.reconcileLanguageWorkspace(projection(modules));
  service.reconcileLanguageWorkspace(projection(modules));
  await settle();
  assert.equal(calls, 1);
  assert.equal(service.getLanguageAcquisitionError(), "offline");

  fail = false;
  service.retryLanguageAcquisition();
  await settle();
  assert.equal(calls, 2);
  assert.equal(service.getLanguageAcquisitionError(), "");
});

test("changing the module list after a failure acquires again", async () => {
  let calls = 0;
  const service = harness(async () => {
    if (++calls === 1) {
      throw new Error("offline");
    }
  });
  service.reconcileLanguageWorkspace(
    projection([{ id: "a", packageName: "a" }])
  );
  await settle();
  service.reconcileLanguageWorkspace(
    projection([{ id: "b", packageName: "b" }])
  );
  await settle();
  assert.equal(calls, 2);
  assert.equal(service.getLanguageAcquisitionError(), "");
});
