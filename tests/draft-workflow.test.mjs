import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as redux from "@reduxjs/toolkit";
import * as publication from "../packages/renderer/src/shared/services/userscript-publication.ts";
import {
  removeScriptFromMatchingTabs,
  applyScriptsToMatchingTabs,
} from "../packages/runtime/src/ide/scripts.ts";
import {
  setCssBookmark,
  getCssBookmark,
} from "../packages/runtime/src/ide/css-bookmarks.ts";
import {
  ChromeSyncStorage,
  CompiledCodeStorage,
} from "../packages/shared/src/storage/index.ts";
import * as publicationActions from "../packages/renderer/src/shared/store/slices/userscripts/actions.publication.ts";
import * as reconciliation from "../packages/renderer/src/shared/services/storage-reconciliation.ts";
import * as model from "../packages/shared/src/model.ts";
import * as hydrate from "../packages/shared/src/userscript-hydrate.ts";
import * as imports from "../packages/shared/src/shared-module-imports.ts";
import * as lifecycle from "../packages/renderer/src/shared/services/draft-save-lifecycle.ts";
import * as draftState from "../packages/renderer/src/shared/store/slices/editor-drafts/state.editor-drafts.ts";
import * as transitions from "../packages/renderer/src/shared/store/slices/editor-drafts/editor-drafts-transitions.ts";
import * as draftHelpers from "../packages/renderer/src/shared/store/slices/editor-drafts/helpers.ts";
import * as draftActions from "../packages/renderer/src/shared/store/slices/editor-drafts/actions.ts";
import * as compileMetadata from "../packages/shared/src/compile-metadata.ts";
import { PrettierFormatter } from "../packages/renderer/src/sandbox/formatter.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

// Load unmodified thunk/reducer bodies with explicit production dependency
// adapters. This keeps browser-only Monaco/compiler modules out of Node while
// exercising real Redux dispatch, publication, save commits and completion.
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

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

let nextHarness = 0;
function harness(count = 1) {
  const prefix = `workflow-${++nextHarness}`;
  const scripts = Array.from({ length: count }, (_, i) =>
    buildUserscriptFixture({
      id: `${prefix}-${i}`,
      moduleName: `${prefix}-${i}`,
    })
  );
  const sources = Object.fromEntries(
    scripts.map((script) => [script.id, structuredClone(script)])
  );
  const artifacts = {};
  const effects = {
    format: (code, language) => PrettierFormatter.format(code, language),
    apply: async () => ({ success: true, appliedTabCount: 1 }),
  };
  const options = { minifyCompiledOutput: false };
  const calls = [];
  const sourceStorage = {
    getAllScripts: async () => structuredClone(sources),
    hasScriptManifest: async (id) => id in sources,
    getEditorSettings: async () => ({ ...options }),
    saveScript: async (script) => {
      sources[script.id] = structuredClone(script);
    },
    updateScript: async (id, script) => {
      calls.push(`save:${id}:${script.code.source.typescript}`);
      sources[id] = { ...sources[id], ...structuredClone(script) };
    },
    deleteScript: async (id) => {
      delete sources[id];
    },
  };
  const compiledStorage = {
    getCompiledCode: async (id) => artifacts[id],
    getAllCompiledCode: async () => structuredClone(artifacts),
    saveCompiledCode: async (id, artifact) => {
      artifacts[id] = structuredClone(artifact);
    },
    deleteCompiledCode: async (id) => {
      delete artifacts[id];
    },
  };
  const compile = async (script) =>
    compileMetadata.buildCompiledCodeEntry(
      `built:${options.minifyCompiledOutput}:${script.code.source.typescript}`,
      script.code.source.scss,
      {
        ...options,
        sourceHash: compileMetadata.hashUserscriptCompileSources(script),
      }
    );
  const apply = (ids) => effects.apply(ids);
  const publicationContext = (getState) => ({
    sourceStorage,
    compiledStorage,
    getLocalScripts: () => getState().userscripts.scripts,
    getBuildOptions: () => ({ ...options }),
    compileAll: compile,
    compileJavascript: async (script) => (await compile(script)).javascript,
  });
  const saveThunks = loadModule(
    "shared/store/slices/userscripts/thunks.save.ts",
    {
      "@reduxjs/toolkit/react": redux,
      "./actions.publication": publicationActions,
      "../../../services/draft-save-lifecycle": lifecycle,
      "../userscripts/actions.publication": publicationActions,
      "../../../services/userscript-publication": publication,
      "./publication-context": { publicationContext },
      "../editor-drafts/actions": draftActions,
      "@shared/storage": {
        ChromeSyncStorage: sourceStorage,
        CompiledCodeStorage: compiledStorage,
      },
      "./compile-helpers": { compileAllOutputsOrThrow: compile },
      "./messaging": { sendApplyScriptsMessage: apply },
      "@/sandbox/formatter": {
        PrettierFormatter: { format: (...args) => effects.format(...args) },
      },
    }
  );
  const rebuildThunks = loadModule(
    "shared/store/slices/userscripts/thunks.compile.ts",
    {
      "@reduxjs/toolkit/react": redux,
      "./actions.publication": publicationActions,
      "@shared/storage": { ChromeSyncStorage: sourceStorage },
      "../../../services/userscript-publication": publication,
      "./publication-context": { publicationContext },
      "./messaging": { sendApplyScriptsMessage: apply },
    }
  );
  const crud = loadModule("shared/store/slices/userscripts/thunks.crud.ts", {
    "@reduxjs/toolkit/react": redux,
    "./actions.publication": publicationActions,
    "@shared/storage": {
      ChromeSyncStorage: sourceStorage,
      CompiledCodeStorage: compiledStorage,
    },
    "../../../services/userscript-publication": publication,
    "@shared/utils": { uuid: () => `${prefix}-created` },
    "./messaging": { sendSetEnabledMessage: apply },
    "./state.userscripts": { DefaultNewUserscriptName: "New Script" },
  });
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
  const { refreshScriptsFromStorage } = loadModule(
    "shared/store/slices/editor-drafts/thunks.storage-sync.ts",
    {
      "@reduxjs/toolkit/react": redux,
      "../../../services/storage-reconciliation": reconciliation,
      "./storage-sync-context": { storageSyncContext },
    }
  );
  let importId = 0;
  const { importUserscripts } = loadModule(
    "shared/store/slices/userscripts/thunks.import.ts",
    {
      "@reduxjs/toolkit/react": redux,
      "./actions.publication": publicationActions,
      "../../../services/userscript-publication": publication,
      "@shared/model": model,
      "@shared/shared-module-imports": imports,
      "@shared/storage": {
        ChromeSyncStorage: sourceStorage,
        CompiledCodeStorage: compiledStorage,
      },
      "@shared/userscript-hydrate": hydrate,
      "@shared/utils": { uuid: () => `${prefix}-imported-${++importId}` },
      "./compile-helpers": { compileAllOutputsOrThrow: compile },
      "./messaging": { sendApplyScriptsMessage: apply },
    }
  );
  const userscripts = loadModule("shared/store/slices/userscripts/index.ts", {
    "@reduxjs/toolkit": redux,
    "./actions.publication": publicationActions,
    "@shared/compile-metadata": compileMetadata,
    "./thunks.load": { loadUserscripts },
    "./thunks.crud": crud,
    "./thunks.save": saveThunks,
    "./thunks.compile": rebuildThunks,
    "./thunks.import": { importUserscripts },
    "./selectors": {},
    "./state.userscripts": {
      initialState: { scripts: {}, currentScriptId: null },
    },
  });
  const thunks = {
    ...saveThunks,
    ...rebuildThunks,
    ...crud,
    loadUserscripts,
    importUserscripts,
    refreshScriptsFromStorage,
  };
  const drafts = loadModule("shared/store/slices/editor-drafts/index.ts", {
    "@reduxjs/toolkit": redux,
    "../../../services/draft-save-lifecycle": lifecycle,
    "../userscripts/actions.publication": publicationActions,
    "../userscripts": userscripts,
    "../userscripts/thunks.userscripts": thunks,
    "./actions": draftActions,
    "./editor-drafts-transitions": transitions,
    "./state.editor-drafts": draftState,
    "./helpers": draftHelpers,
    "./selectors": {},
  });
  const conflicts = loadModule(
    "shared/store/slices/editor-drafts/thunks.conflicts.ts",
    {
      "@reduxjs/toolkit": redux,
      "../userscripts/thunks.userscripts": thunks,
    }
  );
  const codeEditor = loadModule(
    "shared/store/slices/code-editor/thunks.code-editor.ts",
    {
      "@reduxjs/toolkit/react": redux,
      "./actions.publication": publicationActions,
      "@packages/monaco": { registerMonaco() {} },
      "../userscripts/thunks.userscripts": thunks,
    }
  );
  const store = redux.configureStore({
    reducer: {
      userscripts: userscripts.default,
      editorDrafts: drafts.default,
      modules: (state = { modules: {} }) => state,
    },
    preloadedState: {
      userscripts: {
        scripts: structuredClone(sources),
        currentScriptId: scripts[0].id,
      },
      editorDrafts: {
        drafts: Object.fromEntries(
          scripts.map((script) => [
            script.id,
            draftState.draftFromScript(script),
          ])
        ),
        pendingConflicts: {},
      },
    },
  });
  const enqueue = (id = scripts[0].id, version = "remote") => {
    const script = buildUserscriptFixture({
      id,
      code: { source: { typescript: version } },
    });
    store.dispatch(
      drafts.enqueueConflict({
        scriptId: id,
        scriptName: script.name,
        remoteScript: script,
        buffers: [{ buffer: "typescript", local: "local", remote: version }],
      })
    );
    return store.getState().editorDrafts.pendingConflicts[id].conflictId;
  };
  return {
    store,
    scripts,
    id: scripts[0].id,
    sources,
    artifacts,
    sourceStorage,
    compiledStorage,
    effects,
    options,
    calls,
    thunks,
    drafts,
    userscripts,
    conflicts,
    codeEditor,
    enqueue,
    save: (args) =>
      store
        .dispatch(
          saveThunks.persistScriptBuffers({ scriptId: scripts[0].id, ...args })
        )
        .unwrap(),
    edit: (buffer, code, id = scripts[0].id) =>
      store.dispatch(drafts.updateDraftBuffer({ scriptId: id, buffer, code })),
  };
}

describe("ordered editor saves", () => {
  it("admits the old save before formatting and publishes every invocation in order", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred(),
      formatted = [];
    h.effects.format = async (code) => {
      formatted.push(code);
      if (code === "older") {
        entered.resolve();
        await release.promise;
      }
      return `formatted:${code}`;
    };
    const save = (code) =>
      h.store
        .dispatch(
          h.codeEditor.saveEditorCode({
            scriptId: h.id,
            language: "typescript",
            code,
            autoFormat: true,
          })
        )
        .unwrap();
    h.edit("typescript", "older");
    const older = save("older");
    await entered.promise;
    h.edit("typescript", "newer");
    const newer = save("newer");
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(formatted, ["older"]);
    assert.equal(h.calls.length, 0);
    release.resolve();
    assert.equal((await older).code, "formatted:older");
    assert.equal((await newer).code, "formatted:newer");
    assert.deepEqual(h.calls, [
      `save:${h.id}:formatted:older`,
      `save:${h.id}:formatted:newer`,
    ]);
    assert.equal(h.sources[h.id].code.source.typescript, "formatted:newer");
    assert.equal(h.artifacts[h.id].javascript, "built:false:formatted:newer");
    assert.equal(
      h.store.getState().editorDrafts.drafts[h.id].typescript,
      "formatted:newer"
    );
  });

  it("captures every pane before formatting and preserves later edits", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    h.edit("scss", "old scss");
    h.edit("typeDefinitions", "old types");
    h.effects.format = async () => {
      entered.resolve();
      await release.promise;
      return "formatted";
    };
    const saving = h.save({
      focusedBuffer: {
        buffer: "typescript",
        code: "Monaco text",
        autoFormat: true,
      },
    });
    await entered.promise;
    h.edit("typescript", "new ts");
    h.edit("scss", "new scss");
    h.edit("typeDefinitions", "new types");
    release.resolve();
    await saving;
    assert.deepEqual(h.sources[h.id].code.source, {
      typescript: "formatted",
      scss: "old scss",
    });
    assert.equal(h.sources[h.id].typeDefinitions, "old types");
    const draft = h.store.getState().editorDrafts.drafts[h.id];
    assert.equal(draft.typescript, "new ts");
    assert.equal(draft.scss, "new scss");
    assert.equal(draft.typeDefinitions, "new types");
    assert.ok(Object.values(draft.dirty).every(Boolean));
  });

  it("formats types without compiling or applying and retains formatter fallback", async () => {
    const h = harness();
    h.effects.apply = async () => {
      assert.fail("types save applied");
    };
    const result = await h.save({
      focusedBuffer: {
        buffer: "typeDefinitions",
        code: "type X=number",
        autoFormat: true,
      },
      compile: false,
      applyTabs: false,
    });
    assert.equal(result.script.typeDefinitions, "type X = number;\n");
    assert.equal(h.artifacts[h.id], undefined);
    const originalError = console.error;
    console.error = () => {};
    try {
      await h.save({
        focusedBuffer: {
          buffer: "typeDefinitions",
          code: "type = ;",
          autoFormat: true,
        },
        compile: false,
        applyTabs: false,
      });
    } finally {
      console.error = originalError;
    }
    assert.equal(h.sources[h.id].typeDefinitions, "type = ;");
  });

  it("allows another script to save during formatting and recovers after a formatter rejection", async () => {
    const h = harness(2),
      entered = deferred(),
      release = deferred();
    h.effects.format = async () => {
      entered.resolve();
      await release.promise;
      throw Error("formatter rejected");
    };
    const rejected = assert.rejects(
      h.save({
        focusedBuffer: {
          buffer: "typescript",
          code: "first",
          autoFormat: true,
        },
      }),
      { message: "formatter rejected" }
    );
    await entered.promise;
    await h.store
      .dispatch(h.thunks.persistScriptBuffers({ scriptId: h.scripts[1].id }))
      .unwrap();
    assert.ok(h.artifacts[h.scripts[1].id]);
    const later = h.save({
      focusedBuffer: { buffer: "typescript", code: "later", autoFormat: false },
    });
    release.resolve();
    await rejected;
    await later;
    assert.equal(h.sources[h.id].code.source.typescript, "later");
  });
});

describe("derived result acceptance", () => {
  it("cannot resurrect a deletion while a rebuild waits for tab application", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    h.effects.apply = async () => {
      entered.resolve();
      await release.promise;
      return { success: true, appliedTabCount: 0 };
    };
    const rebuilding = h.store
      .dispatch(h.thunks.rebuildCompiledUserscripts({ scope: "all" }))
      .unwrap();
    await entered.promise;
    await h.store.dispatch(h.thunks.deleteUserscript(h.id)).unwrap();
    release.resolve();
    await rebuilding;
    assert.equal(h.store.getState().userscripts.scripts[h.id], undefined);
    assert.equal(h.store.getState().editorDrafts.drafts[h.id], undefined);
    assert.equal(h.sources[h.id], undefined);
    assert.equal(h.artifacts[h.id], undefined);
  });

  it("retains the latest build settings when older tab application finishes last", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    let applies = 0;
    h.effects.apply = async () => {
      if (++applies === 1) {
        entered.resolve();
        await release.promise;
      }
      return { success: true, appliedTabCount: 0 };
    };
    const older = h.store
      .dispatch(h.thunks.rebuildCompiledUserscripts({ scope: "all" }))
      .unwrap();
    await entered.promise;
    h.options.minifyCompiledOutput = true;
    await h.store
      .dispatch(h.thunks.rebuildCompiledUserscripts({ scope: "all" }))
      .unwrap();
    release.resolve();
    await older;
    assert.equal(h.artifacts[h.id].build.minifyCompiledOutput, true);
    assert.equal(
      h.store.getState().userscripts.scripts[h.id].code.compiled.javascript,
      `built:true:${h.scripts[0].code.source.typescript}`
    );
  });

  it("merges only a compatible compiled overlay into current metadata", () => {
    const h = harness();
    const current = {
      ...h.scripts[0],
      name: "current name",
      enabled: false,
      typeDefinitions: "new types",
    };
    h.store.dispatch(h.userscripts.syncScriptsFromRemote([current]));
    const result = structuredClone(h.scripts[0]);
    result.code.compiled.javascript = "rebuilt";
    h.store.dispatch(h.thunks.acceptRebuiltArtifact(result));
    const accepted = h.store.getState().userscripts.scripts[h.id];
    assert.equal(accepted.name, "current name");
    assert.equal(accepted.enabled, false);
    assert.equal(accepted.typeDefinitions, "new types");
    assert.equal(accepted.code.compiled.javascript, "rebuilt");
    const obsolete = structuredClone(result);
    obsolete.moduleName = "obsolete module";
    obsolete.code.compiled.javascript = "obsolete";
    h.store.dispatch(h.thunks.acceptRebuiltArtifact(obsolete));
    assert.equal(
      h.store.getState().userscripts.scripts[h.id].code.compiled.javascript,
      "rebuilt"
    );
  });

  it("does not recreate missing entities or drafts through delayed derived fulfillment", async () => {
    const h = harness();
    await h.store.dispatch(h.thunks.deleteUserscript(h.id)).unwrap();
    h.store.dispatch(
      h.thunks.persistScriptBuffers.fulfilled(
        { script: h.scripts[0], conflictId: null },
        "late",
        { scriptId: h.id }
      )
    );
    h.store.dispatch(
      h.thunks.updateUserscript.fulfilled(h.scripts[0], "late", { id: h.id })
    );
    h.store.dispatch(
      h.thunks.toggleUserscript.fulfilled(
        { script: h.scripts[0] },
        "late",
        h.id
      )
    );
    h.store.dispatch(h.thunks.acceptRebuiltArtifact(h.scripts[0]));
    assert.equal(h.store.getState().userscripts.scripts[h.id], undefined);
    assert.equal(h.store.getState().editorDrafts.drafts[h.id], undefined);
  });

  it("retains deliberate load, create, import and remote discovery additions", async () => {
    const h = harness();
    const remote = buildUserscriptFixture({ id: `${h.id}-loaded` });
    h.sources[remote.id] = remote;
    await h.store.dispatch(h.thunks.loadUserscripts()).unwrap();
    assert.ok(h.store.getState().userscripts.scripts[remote.id]);
    const created = await h.store
      .dispatch(h.thunks.createUserscript())
      .unwrap();
    assert.ok(h.store.getState().userscripts.scripts[created.id]);
    assert.ok(h.store.getState().editorDrafts.drafts[created.id]);
    const [imported] = await h.store
      .dispatch(h.thunks.importUserscripts(transferFile()))
      .unwrap();
    assert.ok(h.store.getState().userscripts.scripts[imported.id]);
    assert.ok(h.store.getState().editorDrafts.drafts[imported.id]);
  });
});

describe("conflict observation ownership", () => {
  it("preserves newly arriving conflicts while bulk keep-local is saving", async () => {
    const h = harness(2),
      entered = deferred(),
      release = deferred();
    h.enqueue();
    h.effects.apply = async () => {
      entered.resolve();
      await release.promise;
      return { success: true, appliedTabCount: 0 };
    };
    const resolving = h.store
      .dispatch(h.conflicts.keepAllLocalConflictsAndPersist())
      .unwrap();
    await entered.promise;
    const otherId = h.scripts[1].id;
    h.enqueue(otherId, "new conflict");
    release.resolve();
    await resolving;
    assert.deepEqual(
      Object.keys(h.store.getState().editorDrafts.pendingConflicts),
      [otherId]
    );
    assert.equal(h.calls.length, 1);
  });

  for (const operation of ["ordinary", "single", "bulk"]) {
    it(`${operation} save cannot acknowledge a replacement conflict`, async () => {
      const h = harness(),
        entered = deferred(),
        release = deferred();
      const oldId = h.enqueue();
      h.effects.apply = async () => {
        entered.resolve();
        await release.promise;
        return { success: true, appliedTabCount: 0 };
      };
      const resolving =
        operation === "ordinary"
          ? h.save()
          : h.store
              .dispatch(
                operation === "single"
                  ? h.conflicts.keepLocalConflictAndPersist(h.id)
                  : h.conflicts.keepAllLocalConflictsAndPersist()
              )
              .unwrap();
      await entered.promise;
      const newId = h.enqueue(h.id, "replacement");
      assert.notEqual(newId, oldId);
      release.resolve();
      await resolving;
      assert.equal(
        h.store.getState().editorDrafts.pendingConflicts[h.id].conflictId,
        newId
      );
    });
  }

  it("an ordinary save with no observed conflict leaves a new conflict pending", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    h.effects.apply = async () => {
      entered.resolve();
      await release.promise;
      return { success: true, appliedTabCount: 0 };
    };
    const saving = h.save();
    await entered.promise;
    const id = h.enqueue();
    release.resolve();
    await saving;
    assert.equal(
      h.store.getState().editorDrafts.pendingConflicts[h.id].conflictId,
      id
    );
  });

  it("skips a later bulk observation replaced before its save starts", async () => {
    const h = harness(2),
      entered = deferred(),
      release = deferred();
    const other = h.scripts[1].id;
    h.enqueue();
    h.enqueue(other);
    h.effects.apply = async () => {
      entered.resolve();
      await release.promise;
      return { success: true, appliedTabCount: 0 };
    };
    const resolving = h.store
      .dispatch(h.conflicts.keepAllLocalConflictsAndPersist())
      .unwrap();
    await entered.promise;
    const replacement = h.enqueue(other, "replacement");
    release.resolve();
    await resolving;
    assert.equal(h.calls.length, 1);
    assert.equal(
      h.store.getState().editorDrafts.pendingConflicts[other].conflictId,
      replacement
    );
  });

  it("keeps equivalent echo identity and clears the observation after an ordinary successful save", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    const id = h.enqueue();
    h.effects.apply = async () => {
      entered.resolve();
      await release.promise;
      return { success: true, appliedTabCount: 0 };
    };
    const saving = h.save();
    await entered.promise;
    assert.equal(h.enqueue(), id);
    release.resolve();
    await saving;
    assert.equal(
      h.store.getState().editorDrafts.pendingConflicts[h.id],
      undefined
    );
  });

  it("bulk saves sequentially, stops on failure, and retains unresolved observations", async () => {
    const h = harness(3);
    for (const script of h.scripts) {
      h.enqueue(script.id);
    }
    let applies = 0;
    h.effects.apply = async () => {
      if (++applies === 2) {
        throw Error("apply failed");
      }
      return { success: true, appliedTabCount: 0 };
    };
    await assert.rejects(
      h.store.dispatch(h.conflicts.keepAllLocalConflictsAndPersist()).unwrap(),
      { message: "apply failed" }
    );
    assert.equal(h.calls.length, 2);
    assert.deepEqual(
      Object.keys(h.store.getState().editorDrafts.pendingConflicts),
      h.scripts.slice(1).map((script) => script.id)
    );
    assert.ok(
      h.store.getState().editorDrafts.drafts[h.scripts[1].id].dirty.typescript
    );
  });

  it("take-remote still replaces local buffers and clears its conflict", () => {
    const h = harness();
    h.edit("typescript", "local");
    h.enqueue(h.id, "remote text");
    const remote =
      h.store.getState().editorDrafts.pendingConflicts[h.id].remoteScript;
    h.store.dispatch(h.drafts.resolveConflictTakeRemote(remote));
    assert.equal(
      h.store.getState().editorDrafts.drafts[h.id].typescript,
      "remote text"
    );
    assert.equal(
      h.store.getState().editorDrafts.drafts[h.id].dirty.typescript,
      false
    );
    assert.equal(
      h.store.getState().editorDrafts.pendingConflicts[h.id],
      undefined
    );
  });
});

function transferFile() {
  return {
    userscripts: [
      {
        name: "Imported",
        enabled: false,
        moduleName: "",
        globalModuleImports: [],
        sharedImports: [],
        sources: {
          typescript: "export {};",
          scss: "",
          "typescript-declarations": "",
        },
        urlPatterns: ["*://*/*"],
        runAt: "afterPageLoad",
      },
    ],
  };
}

describe("publication and observation ownership", () => {
  it("orders overlapping toggle application and preserves the compiled overlay", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    let applies = 0;
    h.effects.apply = async () => {
      if (++applies === 1) {
        entered.resolve();
        await release.promise;
      }
      return { success: true, appliedTabCount: 0 };
    };
    const first = h.store.dispatch(h.thunks.toggleUserscript(h.id)).unwrap();
    await entered.promise;
    const second = h.store.dispatch(h.thunks.toggleUserscript(h.id)).unwrap();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(applies, 1);
    assert.equal(h.sources[h.id].enabled, false);
    release.resolve();
    await Promise.all([first, second]);
    assert.equal(h.store.getState().userscripts.scripts[h.id].enabled, true);
    assert.equal(h.sources[h.id].enabled, true);
    assert.equal(
      h.store.getState().userscripts.scripts[h.id].code.compiled.javascript,
      h.scripts[0].code.compiled.javascript
    );
  });

  it("rejects a draft save queued behind successful source deletion", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    const remove = h.sourceStorage.deleteScript;
    h.sourceStorage.deleteScript = async (id) => {
      entered.resolve();
      await release.promise;
      await remove(id);
    };
    const deleting = h.store.dispatch(h.thunks.deleteUserscript(h.id)).unwrap();
    await entered.promise;
    const saving = h.store
      .dispatch(h.thunks.persistScriptBuffers({ scriptId: h.id }))
      .unwrap();
    const rejected = assert.rejects(saving, {
      message: `Userscript not found: ${h.id}`,
    });
    release.resolve();
    await deleting;
    await rejected;
    assert.equal(h.sources[h.id], undefined);
    assert.equal(h.artifacts[h.id], undefined);
    assert.equal(h.store.getState().userscripts.scripts[h.id], undefined);
    assert.equal(h.store.getState().editorDrafts.drafts[h.id], undefined);
  });

  it("cannot reintroduce an imported script through late apply completion", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    h.effects.apply = async () => {
      entered.resolve();
      await release.promise;
      return { success: true, appliedTabCount: 0 };
    };
    const importing = h.store
      .dispatch(h.thunks.importUserscripts(transferFile()))
      .unwrap();
    await entered.promise;
    const id = Object.keys(h.sources).find((id) => id.includes("imported"));
    assert.ok(h.store.getState().userscripts.scripts[id]);
    await h.store.dispatch(h.thunks.deleteUserscript(id)).unwrap();
    release.resolve();
    await importing;
    assert.equal(h.sources[id], undefined);
    assert.equal(h.store.getState().userscripts.scripts[id], undefined);
    assert.equal(h.store.getState().editorDrafts.drafts[id], undefined);
  });

  for (const kind of ["load", "refresh"]) {
    it(`${kind} retries a snapshot captured before a local save`, async () => {
      const h = harness(),
        entered = deferred(),
        release = deferred();
      let reads = 0;
      h.compiledStorage.getAllCompiledCode = async () => {
        if (++reads === 1) {
          entered.resolve();
          await release.promise;
        }
        return structuredClone(h.artifacts);
      };
      const observing = h.store
        .dispatch(
          kind === "load"
            ? h.thunks.loadUserscripts()
            : h.thunks.refreshScriptsFromStorage()
        )
        .unwrap();
      await entered.promise;
      h.edit("typescript", "new source");
      await h.store
        .dispatch(
          h.thunks.persistScriptBuffers({ scriptId: h.id, applyTabs: false })
        )
        .unwrap();
      release.resolve();
      await observing;
      assert.ok(reads >= 2);
      assert.equal(
        h.store.getState().userscripts.scripts[h.id].code.source.typescript,
        "new source"
      );
      assert.equal(
        h.store.getState().editorDrafts.drafts[h.id].typescript,
        "new source"
      );
      assert.deepEqual(
        Object.keys(h.store.getState().editorDrafts.pendingConflicts),
        []
      );
    });
  }
});

it("ordered toggles leave CSS installed after an older disable is delayed", async () => {
  const h = harness(),
    entered = deferred(),
    release = deferred();
  const previousChrome = globalThis.chrome;
  const sourceReads = ChromeSyncStorage.getAllScripts;
  const moduleReads = ChromeSyncStorage.getAllModules;
  const settingsReads = ChromeSyncStorage.getEditorSettings;
  const artifactReads = CompiledCodeStorage.getCompiledCodeForScripts;
  let stylesheetPresent = true,
    queries = 0;
  globalThis.chrome = {
    tabs: {
      query: async () => {
        if (++queries === 1) {
          entered.resolve();
          await release.promise;
        }
        return [{ id: 123, url: "https://example.com/" }];
      },
    },
    storage: { session: { get: async () => ({}), set: async () => {} } },
    scripting: {
      removeCSS: async () => {
        stylesheetPresent = false;
      },
      insertCSS: async () => {
        stylesheetPresent = true;
      },
      executeScript: async () => {},
    },
  };
  ChromeSyncStorage.getAllScripts = async () => structuredClone(h.sources);
  ChromeSyncStorage.getAllModules = async () => ({});
  ChromeSyncStorage.getEditorSettings = async () => ({
    minifyCompiledOutput: false,
  });
  CompiledCodeStorage.getCompiledCodeForScripts = async () => ({
    [h.id]: compileMetadata.buildCompiledCodeEntry("", "body{color:red}", {
      minifyCompiledOutput: false,
      sourceHash: compileMetadata.hashUserscriptCompileSources(h.sources[h.id]),
    }),
  });
  try {
    await setCssBookmark(123, h.id, "body{color:red}");
    h.effects.apply = async () =>
      h.sources[h.id].enabled
        ? applyScriptsToMatchingTabs([h.id])
        : removeScriptFromMatchingTabs(h.id).then((result) => ({
            success: true,
            appliedTabCount: 0,
            ...result,
          }));
    const disabling = h.store
      .dispatch(h.thunks.toggleUserscript(h.id))
      .unwrap();
    await entered.promise;
    const enabling = h.store.dispatch(h.thunks.toggleUserscript(h.id)).unwrap();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(queries, 1);
    release.resolve();
    await Promise.all([disabling, enabling]);
    assert.equal(h.sources[h.id].enabled, true);
    assert.equal(h.store.getState().userscripts.scripts[h.id].enabled, true);
    assert.equal(stylesheetPresent, true);
    assert.equal(await getCssBookmark(123, h.id), "body{color:red}");
  } finally {
    release.resolve();
    globalThis.chrome = previousChrome;
    ChromeSyncStorage.getAllScripts = sourceReads;
    ChromeSyncStorage.getAllModules = moduleReads;
    ChromeSyncStorage.getEditorSettings = settingsReads;
    CompiledCodeStorage.getCompiledCodeForScripts = artifactReads;
  }
});
