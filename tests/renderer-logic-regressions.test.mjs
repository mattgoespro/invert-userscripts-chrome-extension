import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, it, mock } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  getConflictDialogCloseAction,
  getPersistErrorMessage,
  isConflictDialogOpen,
} from "../packages/renderer/src/options/invert-ide/components/conflict-dialog/conflict-dialog-state.ts";
import {
  createKeyedDebouncer,
  rebaseList,
  rebaseListUpdates,
  resolveMetadataUpdates,
  toggleListItem,
} from "../packages/renderer/src/shared/services/metadata-edits.ts";
import { projectWorkspace } from "../packages/renderer/src/shared/services/workspace-sync-plan.ts";
import {
  applyCommitDraftForSave,
  applyMergeRemoteIntoDraft,
  applyPruneCleanDrafts,
  applySaveRejectionDirtyRestore,
  applySaveSettled,
  applySaveStarted,
  clearSaveBaseline,
} from "../packages/renderer/src/shared/store/slices/editor-drafts/editor-drafts-transitions.ts";
import { draftFromScript } from "../packages/renderer/src/shared/store/slices/editor-drafts/state.editor-drafts.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

function sourcePath(relative) {
  return fileURLToPath(
    new URL(`../packages/renderer/src/${relative}`, import.meta.url)
  );
}

describe("draft recovery", () => {
  function loadRecoveryService(globals) {
    const path = sourcePath("shared/services/draft-recovery-service.ts");
    const javascript = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
      fileName: path,
    }).outputText;
    const exports = {};
    const dependencies = {
      "../store/slices/editor-drafts": {
        ensureDraft: (script) => ({ type: "ensure", script }),
        updateDraftBuffer: (payload) => ({ type: "update", payload }),
        enqueueConflict: (payload) => ({ type: "conflict", payload }),
      },
      "@shared/storage/sync/revision-codec": { sha256: async (text) => text },
      "./editor-session-service": { checkpointSession: async () => {} },
    };
    vm.runInNewContext(javascript, {
      exports,
      console,
      setTimeout,
      clearTimeout,
      crypto,
      require: (name) => dependencies[name],
      ...globals,
    });
    return exports;
  }

  const buffers = (typescript) => ({
    typescript,
    scss: "",
    typeDefinitions: "",
  });

  it("retires every eligible checkpoint, but restores only the newest", async () => {
    const script = buildUserscriptFixture({ id: "s1" });
    const checkpoint = (updatedAt, typescript, tabId) => ({
      scriptId: "s1",
      sessionId: "x",
      baseRevision: "base",
      tabId,
      updatedAt,
      buffers: buffers(typescript),
    });
    const removed = [];
    const service = loadRecoveryService({
      sessionStorage: { getItem: () => "session", setItem() {} },
      window: { addEventListener() {}, removeEventListener() {} },
      chrome: {
        storage: {
          local: {
            get: async () => ({
              "draft-recovery:new:s1": checkpoint(3, "newest"),
              "draft-recovery:old:s1": checkpoint(1, "stale"),
              "draft-recovery:live:s1": checkpoint(2, "other tab", 7),
            }),
            remove: async (keys) => {
              removed.push(...[keys].flat());
            },
          },
        },
        tabs: {
          getCurrent: async () => ({ id: 1 }),
          get: async () => ({ id: 7 }),
        },
      },
    });
    const dispatched = [];
    const store = {
      getState: () => ({
        userscripts: { scripts: { s1: script } },
        editorDrafts: { drafts: {} },
      }),
      dispatch: (action) => dispatched.push(action),
      subscribe: () => () => {},
    };

    await service.restoreDraftRecovery(store);
    assert.deepEqual(
      dispatched
        .filter(
          (action) =>
            action.type === "update" && action.payload.buffer === "typescript"
        )
        .map((action) => action.payload.code),
      ["newest"]
    );

    service.startDraftRecovery(store)();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(removed.includes("draft-recovery:new:s1"));
    assert.ok(
      removed.includes("draft-recovery:old:s1"),
      "older checkpoint survives to be restored by a later session"
    );
    assert.ok(!removed.includes("draft-recovery:live:s1"));
  });
});

describe("remote merge into a dirty draft", () => {
  function remoteScript(id, typescript, scss) {
    return buildUserscriptFixture({
      id,
      storageRevision: "remote-revision",
      code: { source: { typescript, scss } },
    });
  }

  it("updates clean buffers and their baselines, keeping dirty text", () => {
    const draft = draftFromScript(remoteScript("s1", "base", "old"));
    draft.typescript = "local";
    draft.dirty.typescript = true;
    const revision = draft.revision;

    applyMergeRemoteIntoDraft(draft, remoteScript("s1", "base", "new"));

    assert.equal(draft.scss, "new");
    assert.equal(draft.lastSynced.scss, "new");
    assert.equal(draft.typescript, "local");
    assert.equal(draft.lastSynced.typescript, "base");
    assert.equal(draft.baseSavedRevision, "remote-revision");
    assert.equal(draft.revision, revision + 1);
  });

  it("moves a dirty buffer's baseline when remote already matches its text", () => {
    const draft = draftFromScript(remoteScript("s1", "base", ""));
    draft.typescript = "same";
    draft.dirty.typescript = true;

    applyMergeRemoteIntoDraft(draft, remoteScript("s1", "same", ""));

    assert.equal(draft.lastSynced.typescript, "same");
    assert.equal(draft.dirty.typescript, true);
  });

  it("makes the workspace overwrite attached clean models and preserve dirty ones", () => {
    const script = remoteScript("s1", "base", "old");
    const draft = draftFromScript(script);
    draft.typescript = "local";
    draft.dirty.typescript = true;
    const remote = remoteScript("s1", "base", "new");

    applyMergeRemoteIntoDraft(draft, remote);

    const projection = projectWorkspace({
      scripts: { s1: remote },
      drafts: { s1: draft },
      currentScriptId: "s1",
      modules: {},
    });
    const model = (editor) =>
      projection.models.find((candidate) => candidate.editor === editor);
    assert.equal(model("styles").contents, "new");
    assert.equal(model("styles").preserveAttachedBuffer, false);
    assert.equal(model("main").contents, "local");
    assert.equal(model("main").preserveAttachedBuffer, true);
  });
});

describe("save baseline rollback", () => {
  it("restores lastSynced only for the request that still owns the buffer", () => {
    const draft = draftFromScript(buildUserscriptFixture());
    const original = draft.lastSynced.typescript;

    applyCommitDraftForSave(draft, "typescript", "unwritten", "req-1");
    assert.equal(draft.lastSynced.typescript, "unwritten");
    assert.equal(
      applySaveRejectionDirtyRestore(draft, "typescript", "req-0"),
      false
    );
    assert.equal(draft.lastSynced.typescript, "unwritten");
    assert.equal(
      applySaveRejectionDirtyRestore(draft, "typescript", "req-1"),
      true
    );
    assert.equal(draft.lastSynced.typescript, original);
    assert.equal(draft.dirty.typescript, true);
  });

  it("keeps the new baseline once the write is confirmed", () => {
    const draft = draftFromScript(buildUserscriptFixture());

    applyCommitDraftForSave(draft, "typescript", "written", "req-1");
    clearSaveBaseline(draft, "req-1");
    applySaveRejectionDirtyRestore(draft, "typescript", "req-1");

    assert.equal(draft.lastSynced.typescript, "written");
    assert.equal(draft.dirty.typescript, true);
    assert.equal(draft.saveBaseline, undefined);
  });
});

describe("draft pruning", () => {
  it("keeps clean drafts while any save for them is in flight", () => {
    const script = buildUserscriptFixture({ id: "s1" });
    const state = {
      drafts: { s1: draftFromScript(script) },
      pendingConflicts: {},
    };

    applySaveStarted(state, "s1");
    applySaveStarted(state, "s1");
    applyPruneCleanDrafts(state, []);
    assert.ok(state.drafts.s1);

    applySaveSettled(state, "s1");
    applyPruneCleanDrafts(state, []);
    assert.ok(state.drafts.s1);

    applySaveSettled(state, "s1");
    assert.deepEqual(state.inFlightSaves, {});
    applyPruneCleanDrafts(state, []);
    assert.equal(state.drafts.s1, undefined);
  });
});

describe("conflict dialog state", () => {
  it("closes by saving, then dismisses instead of retrying a failed save", () => {
    assert.equal(getConflictDialogCloseAction(false, null), "keep-all-local");
    assert.equal(getConflictDialogCloseAction(false, "quota"), "dismiss");
    assert.equal(getConflictDialogCloseAction(true, null), "ignore");
    assert.equal(getConflictDialogCloseAction(true, "quota"), "ignore");
  });

  it("stays closed for dismissed conflicts and reopens for a new observation", () => {
    const dismissed = new Set(["a"]);
    assert.equal(isConflictDialogOpen([], dismissed), false);
    assert.equal(isConflictDialogOpen(["a"], dismissed), false);
    assert.equal(isConflictDialogOpen(["a", "b"], dismissed), true);
  });

  it("reads messages from serialized thunk errors", () => {
    assert.equal(getPersistErrorMessage({ message: "quota" }), "quota");
    assert.equal(getPersistErrorMessage(Error("quota")), "quota");
    assert.match(getPersistErrorMessage(undefined), /unknown/);
  });

  it("uses only syntax colours that have a theme token", () => {
    const tokens = readFileSync(sourcePath("assets/styles/theme.css"), "utf8");
    const dialog = readFileSync(
      sourcePath(
        "options/invert-ide/components/conflict-dialog/ConflictDialog.tsx"
      ),
      "utf8"
    );
    for (const [, token] of dialog.matchAll(/\btext-(syntax-[a-z-]+)/g)) {
      assert.ok(tokens.includes(`--color-${token}:`), `${token} has no token`);
    }
  });
});

describe("IDE startup", () => {
  it("does not let a tolerated Shiki failure reject startup", () => {
    const source = readFileSync(
      sourcePath("options/invert-ide/InvertIde.tsx"),
      "utf8"
    );
    assert.match(source, /dispatch\(initializeMonaco\(\)\)/);
    assert.doesNotMatch(source, /initializeMonaco\(\)\)\s*\.unwrap/);
  });
});

describe("metadata list edits", () => {
  it("rebases additions and removals onto the latest list", () => {
    assert.deepEqual(rebaseList(["a", "b"], ["b"], ["a", "b", "c"]), [
      "b",
      "c",
    ]);
    assert.deepEqual(rebaseList(["a"], ["a", "x", "x"], ["a", "y"]), [
      "a",
      "y",
      "x",
    ]);
    assert.deepEqual(rebaseList(["a"], ["a", "x"], ["a", "x"]), ["a", "x"]);
  });

  it("passes non-list edits through and rebases only provided lists", () => {
    const plain = { name: "renamed" };
    assert.equal(rebaseListUpdates({}, plain), plain);
    const latest = buildUserscriptFixture({
      urlPatterns: ["a", "b"],
      globalModules: ["m"],
    });
    const updates = rebaseListUpdates(
      { urlPatterns: ["a"] },
      { urlPatterns: ["a", "c"], name: "renamed" }
    );
    assert.deepEqual(resolveMetadataUpdates(updates, latest), {
      name: "renamed",
      urlPatterns: ["a", "b", "c"],
    });
  });

  it("toggles without duplicating an item", () => {
    assert.deepEqual(toggleListItem(["a"], "a", true), ["a"]);
    assert.deepEqual(toggleListItem(["a"], "b", true), ["a", "b"]);
    assert.deepEqual(toggleListItem(["a", "b"], "a", false), ["b"]);
  });
});

describe("module name debouncing", () => {
  function setup() {
    mock.timers.enable({ apis: ["setTimeout"] });
    const published = [];
    const debouncer = createKeyedDebouncer(
      (key, value) => published.push([key, value]),
      400
    );
    return { published, debouncer };
  }

  it("publishes only the last value for a key", (t) => {
    t.after(() => mock.timers.reset());
    const { published, debouncer } = setup();
    debouncer.schedule("a", "one");
    debouncer.schedule("a", "two");
    mock.timers.tick(400);
    assert.deepEqual(published, [["a", "two"]]);
  });

  it("does not let an edit to another script drop a pending value", (t) => {
    t.after(() => mock.timers.reset());
    const { published, debouncer } = setup();
    debouncer.schedule("a", "for a");
    mock.timers.tick(100);
    debouncer.schedule("b", "for b");
    mock.timers.tick(400);
    assert.deepEqual(published, [
      ["a", "for a"],
      ["b", "for b"],
    ]);
  });

  it("flushes pending values once on unmount", (t) => {
    t.after(() => mock.timers.reset());
    const { published, debouncer } = setup();
    debouncer.schedule("a", "for a");
    debouncer.schedule("b", "for b");
    debouncer.flush();
    assert.deepEqual(published, [
      ["a", "for a"],
      ["b", "for b"],
    ]);
    mock.timers.tick(400);
    assert.equal(published.length, 2);
  });

  it("drops a pending value when cancelled", (t) => {
    t.after(() => mock.timers.reset());
    const { published, debouncer } = setup();
    debouncer.schedule("a", "for a");
    debouncer.cancel("a");
    debouncer.flush();
    mock.timers.tick(400);
    assert.deepEqual(published, []);
  });
});
