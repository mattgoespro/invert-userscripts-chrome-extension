import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createStorageSyncCoordinator,
  reconcileStoredScripts,
} from "../packages/renderer/src/shared/services/storage-reconciliation.ts";
import { draftFromScript } from "../packages/renderer/src/shared/store/slices/editor-drafts/state.editor-drafts.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

describe("storage refresh coordination", () => {
  it("coalesces targeted IDs and rebuilds only after queued refreshes drain", async () => {
    const gate = deferred(),
      entered = deferred(),
      calls = [];
    let count = 0;
    const coordinator = createStorageSyncCoordinator({
      refresh: async (ids) => {
        calls.push(ids);
        if (++count === 1) {
          entered.resolve();
          await gate.promise;
        }
      },
      rebuild: async () => calls.push("rebuild"),
      onError: () => assert.fail("unexpected error"),
    });
    const first = coordinator.requestRefresh(["a"]);
    await entered.promise;
    assert.equal(coordinator.requestRefresh(["b", "c"]), first);
    coordinator.requestRefresh(["c", "d"]);
    gate.resolve();
    await first;
    assert.deepEqual(calls, [["a"], ["b", "c", "d"], "rebuild"]);
  });

  it("lets full refresh supersede pending targeted refreshes", async () => {
    const gate = deferred(),
      entered = deferred(),
      calls = [];
    let count = 0;
    const coordinator = createStorageSyncCoordinator({
      refresh: async (ids) => {
        calls.push(ids);
        if (++count === 1) {
          entered.resolve();
          await gate.promise;
        }
      },
      rebuild: async () => calls.push("rebuild"),
      onError: () => {},
    });
    const task = coordinator.requestRefresh(["a"]);
    await entered.promise;
    coordinator.requestRefresh(["b"]);
    coordinator.requestRefresh();
    coordinator.requestRefresh(["c"]);
    gate.resolve();
    await task;
    assert.deepEqual(calls, [["a"], undefined, "rebuild"]);
  });

  it("queues events during rebuild without overlapping refresh or rebuild effects", async () => {
    const gate = deferred(),
      entered = deferred(),
      calls = [];
    let rebuilds = 0,
      active = 0,
      maxActive = 0;
    const coordinator = createStorageSyncCoordinator({
      refresh: async (ids) => {
        active++;
        maxActive = Math.max(maxActive, active);
        calls.push(ids);
        active--;
      },
      rebuild: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        calls.push("rebuild");
        if (++rebuilds === 1) {
          entered.resolve();
          await gate.promise;
        }
        active--;
      },
      onError: () => {},
    });
    const task = coordinator.requestRefresh(["a"]);
    await entered.promise;
    coordinator.requestRefresh(["b"]);
    await Promise.resolve();
    assert.deepEqual(calls, [["a"], "rebuild"]);
    gate.resolve();
    await task;
    assert.deepEqual(calls, [["a"], "rebuild", ["b"], "rebuild"]);
    assert.equal(maxActive, 1);
  });

  it("disposal drops pending work and avoids rebuild after an in-flight refresh", async () => {
    const gate = deferred(),
      entered = deferred(),
      calls = [];
    const coordinator = createStorageSyncCoordinator({
      refresh: async (ids) => {
        calls.push(ids);
        entered.resolve();
        await gate.promise;
      },
      rebuild: async () => calls.push("rebuild"),
      onError: () => {},
    });
    const task = coordinator.requestRefresh(["a"]);
    await entered.promise;
    coordinator.requestRefresh(["b"]);
    coordinator.dispose();
    gate.resolve();
    await task;
    await coordinator.requestRefresh();
    assert.deepEqual(calls, [["a"]]);
  });

  it("disposal during rebuild permits it to finish but starts no new effects", async () => {
    const gate = deferred(),
      entered = deferred(),
      calls = [];
    const coordinator = createStorageSyncCoordinator({
      refresh: async (ids) => calls.push(ids),
      rebuild: async () => {
        calls.push("rebuild");
        entered.resolve();
        await gate.promise;
      },
      onError: () => {},
    });
    const task = coordinator.requestRefresh(["a"]);
    await entered.promise;
    coordinator.requestRefresh(["b"]);
    coordinator.dispose();
    gate.resolve();
    await task;
    assert.deepEqual(calls, [["a"], "rebuild"]);
  });

  it("reports failures and remains usable for subsequent events", async () => {
    const errors = [],
      calls = [];
    let fail = true;
    const coordinator = createStorageSyncCoordinator({
      refresh: async () => {
        calls.push("refresh");
        if (fail) throw Error("read");
      },
      rebuild: async () => {
        calls.push("rebuild");
        if (fail) throw Error("compile");
      },
      onError: (phase, error) => errors.push([phase, error.message]),
    });
    await coordinator.requestRefresh();
    fail = false;
    await coordinator.requestRefresh(["a"]);
    assert.deepEqual(errors, [
      ["refresh", "read"],
      ["rebuild", "compile"],
    ]);
    assert.deepEqual(calls, ["refresh", "rebuild", "refresh", "rebuild"]);
  });
});

function reconciliationHarness(scripts, drafts = {}) {
  const events = [];
  const context = {
    sourceStorage: {
      getAllScripts: async () => scripts,
      hasScriptManifest: async (id) => id in scripts,
    },
    compiledStorage: { getAllCompiledCode: async () => ({}) },
    getDrafts: () => drafts,
    getScriptIds: () => [],
    syncScripts: () => {},
    removeDraft: (id) => {
      events.push(["remove-draft", id]);
      delete drafts[id];
    },
    enqueueConflict: (conflict) => events.push(["conflict", conflict.scriptId]),
    syncDraft: (script) => {
      events.push(["sync", script.id]);
      drafts[script.id] = draftFromScript(script);
    },
    removeScripts: (ids) => events.push(["remove-scripts", ids]),
  };
  return { context, drafts, events };
}

describe("stored script reconciliation", () => {
  it("reads current drafts after storage resolves, avoiding a false same-tab echo conflict", async () => {
    const script = buildUserscriptFixture(),
      gate = deferred();
    const draft = draftFromScript(script);
    draft.typescript = "edited";
    draft.dirty.typescript = true;
    const h = reconciliationHarness({}, { [script.id]: draft });
    h.context.sourceStorage.getAllScripts = () => gate.promise;
    const task = reconcileStoredScripts(undefined, h.context);
    h.drafts[script.id] = draftFromScript(script);
    gate.resolve({ [script.id]: script });
    const result = await task;
    assert.deepEqual(result.conflictIds, []);
    assert.deepEqual(h.events, [["sync", script.id]]);
  });

  it("updates persisted entities while retaining dirty overlays when remote matches the baseline", async () => {
    const script = buildUserscriptFixture(),
      draft = draftFromScript(script);
    draft.typescript = "unsaved";
    draft.dirty.typescript = true;
    const h = reconciliationHarness(
      { [script.id]: script },
      { [script.id]: draft }
    );
    const result = await reconcileStoredScripts(undefined, h.context);
    assert.equal(result.syncedScripts.length, 1);
    assert.equal(h.drafts[script.id].typescript, "unsaved");
    assert.deepEqual(h.events, []);
  });

  it("reports divergent remote edits without replacing dirty buffers", async () => {
    const script = buildUserscriptFixture(),
      draft = draftFromScript(script);
    draft.typescript = "local";
    draft.dirty.typescript = true;
    const remote = buildUserscriptFixture({
      code: { source: { typescript: "remote" } },
    });
    const h = reconciliationHarness(
      { [script.id]: remote },
      { [script.id]: draft }
    );
    const result = await reconcileStoredScripts(undefined, h.context);
    assert.deepEqual(result.conflictIds, [script.id]);
    assert.equal(h.drafts[script.id].typescript, "local");
    assert.deepEqual(result.syncedScripts, []);
  });

  it("preserves dirty orphan drafts and distinguishes missing chunks from deletion", async () => {
    const dirty = buildUserscriptFixture({ id: "dirty" }),
      clean = buildUserscriptFixture({ id: "clean" }),
      missing = buildUserscriptFixture({ id: "missing" });
    const orphan = draftFromScript(dirty);
    orphan.dirty.scss = true;
    const h = reconciliationHarness(
      {},
      {
        dirty: orphan,
        clean: draftFromScript(clean),
        missing: draftFromScript(missing),
      }
    );
    h.context.sourceStorage.hasScriptManifest = async (id) => id === "missing";
    await reconcileStoredScripts(undefined, h.context);
    assert.ok(h.drafts.dirty);
    assert.ok(h.drafts.missing);
    assert.deepEqual(h.events, [
      ["remove-draft", "clean"],
      ["remove-scripts", ["clean"]],
    ]);
  });

  it("limits reconciliation to requested IDs and hydrates compiled output", async () => {
    const a = buildUserscriptFixture({ id: "a" }),
      b = buildUserscriptFixture({ id: "b" });
    const h = reconciliationHarness({ a, b });
    h.context.compiledStorage.getAllCompiledCode = async () => ({
      a: { javascript: "compiled a", css: ".a{}" },
    });
    const result = await reconcileStoredScripts(["a"], h.context);
    assert.deepEqual(
      result.syncedScripts.map((script) => script.id),
      ["a"]
    );
    assert.equal(
      result.syncedScripts[0].code.compiled.javascript,
      "compiled a"
    );
    assert.deepEqual(h.events, [["sync", "a"]]);
  });
});

describe("atomic storage acceptance", () => {
  it("preserves typing that begins while a missing manifest is checked", async () => {
    const script = buildUserscriptFixture({ id: "manifest-edit" });
    const h = reconciliationHarness(
      {},
      { [script.id]: draftFromScript(script) }
    );
    const entered = deferred(),
      release = deferred();
    h.context.sourceStorage.hasScriptManifest = async () => {
      entered.resolve();
      await release.promise;
      return false;
    };
    const task = reconcileStoredScripts(undefined, h.context);
    await entered.promise;
    assert.ok(h.drafts[script.id]);
    h.drafts[script.id].scss = ".typing {}";
    h.drafts[script.id].dirty.scss = true;
    release.resolve();
    await task;
    assert.equal(h.drafts[script.id].scss, ".typing {}");
    assert.deepEqual(h.events, []);
  });
  it("removes missing known entities even when they have no draft", async () => {
    const h = reconciliationHarness({});
    h.context.getScriptIds = () => ["closed-missing"];
    await reconcileStoredScripts(undefined, h.context);
    assert.deepEqual(h.events, [
      ["remove-draft", "closed-missing"],
      ["remove-scripts", ["closed-missing"]],
    ]);
  });
  it("retries an older overlapping observation after a newer read is accepted", async () => {
    const initial = buildUserscriptFixture({ id: "overlap-observation" });
    const latest = buildUserscriptFixture({
      id: initial.id,
      code: { source: { typescript: "latest remote" } },
    });
    const h = reconciliationHarness({ [initial.id]: initial });
    let sources = { [initial.id]: initial },
      reads = 0;
    const entered = deferred(),
      release = deferred(),
      accepted = [];
    h.context.sourceStorage.getAllScripts = async () =>
      structuredClone(sources);
    h.context.compiledStorage.getAllCompiledCode = async () => {
      if (++reads === 1) {
        entered.resolve();
        await release.promise;
      }
      return {};
    };
    h.context.syncScripts = (scripts) =>
      accepted.push(scripts[0].code.source.typescript);
    const older = reconcileStoredScripts([initial.id], h.context);
    await entered.promise;
    sources = { [initial.id]: latest };
    await reconcileStoredScripts([initial.id], h.context);
    release.resolve();
    await older;
    assert.deepEqual(accepted, ["latest remote", "latest remote"]);
    assert.equal(reads, 3);
  });
});
