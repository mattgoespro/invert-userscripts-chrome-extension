import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as redux from "@reduxjs/toolkit";
import * as publication from "../packages/renderer/src/shared/services/userscript-publication.ts";
import * as publicationActions from "../packages/renderer/src/shared/store/slices/userscripts/actions.publication.ts";
import * as reconciliation from "../packages/renderer/src/shared/services/storage-reconciliation.ts";
import * as draftState from "../packages/renderer/src/shared/store/slices/editor-drafts/state.editor-drafts.ts";
import * as draftActions from "../packages/renderer/src/shared/store/slices/editor-drafts/actions.ts";
import * as userscriptsState from "../packages/renderer/src/shared/store/slices/userscripts/state.userscripts.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

function loadModule(relativePath, dependencies) {
  const path = fileURLToPath(
    new URL(`../packages/renderer/src/${relativePath}`, import.meta.url)
  );
  const source = readFileSync(path, "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: path,
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    javascript,
    {
      exports,
      console,
      require(name) {
        assert.ok(
          name in dependencies,
          `Missing adapter: ${name} in ${relativePath}`
        );
        return dependencies[name];
      },
    },
    { filename: path }
  );
  return exports;
}

describe("popup store publication wiring", () => {
  it("hydrates from loadUserscripts and updates enabled on toggle", async () => {
    const script = buildUserscriptFixture({
      id: "popup-script",
      enabled: true,
    });
    const sources = { [script.id]: structuredClone(script) };
    const artifacts = {
      [script.id]: structuredClone(script.code.compiled),
    };
    const sourceStorage = {
      getAllScripts: async () => structuredClone(sources),
      hasScriptManifest: async (id) => id in sources,
      saveScript: async (next) => {
        sources[next.id] = structuredClone(next);
      },
    };
    const compiledStorage = {
      getAllCompiledCode: async () => structuredClone(artifacts),
    };
    const { storageSyncContext } = loadModule(
      "shared/store/slices/editor-drafts/storage-sync-context.ts",
      {
        "@shared/storage": {
          ChromeSyncStorage: sourceStorage,
          CompiledCodeStorage: compiledStorage,
        },
        "./actions": draftActions,
        "../userscripts/actions.publication": publicationActions,
      }
    );
    const { loadUserscripts } = loadModule(
      "shared/store/slices/userscripts/thunks.load.ts",
      {
        "@reduxjs/toolkit/react": redux,
        "../../../services/storage-reconciliation": reconciliation,
        "../editor-drafts/storage-sync-context": { storageSyncContext },
      }
    );
    const { toggleUserscript } = loadModule(
      "shared/store/slices/userscripts/thunks.crud.ts",
      {
        "@reduxjs/toolkit/react": redux,
        "./actions.publication": publicationActions,
        "@shared/storage": {
          ChromeSyncStorage: sourceStorage,
          CompiledCodeStorage: compiledStorage,
        },
        "../../../services/userscript-publication": publication,
        "@shared/utils": { uuid: () => "unused" },
        "./messaging": {
          sendSetEnabledMessage: async () => ({
            success: true,
            appliedTabCount: 0,
          }),
        },
        "./state.userscripts": userscriptsState,
      }
    );
    const { popupStore } = loadModule("popup/popup-store.ts", {
      "@reduxjs/toolkit": redux,
      "@/shared/store/slices/editor-drafts/state.editor-drafts": draftState,
      "@/shared/store/slices/userscripts/state.userscripts": userscriptsState,
      "@/shared/store/slices/userscripts/actions.publication":
        publicationActions,
    });

    assert.deepEqual(popupStore.getState().userscripts.scripts, {});

    await popupStore.dispatch(loadUserscripts()).unwrap();
    const loaded = popupStore.getState().userscripts.scripts[script.id];
    assert.equal(loaded.name, script.name);
    assert.equal(loaded.enabled, true);

    const toggled = await popupStore.dispatch(toggleUserscript(script.id)).unwrap();
    assert.equal(toggled.script.enabled, false);
    assert.equal(
      popupStore.getState().userscripts.scripts[script.id].enabled,
      false
    );
    assert.equal(sources[script.id].enabled, false);
  });
});
