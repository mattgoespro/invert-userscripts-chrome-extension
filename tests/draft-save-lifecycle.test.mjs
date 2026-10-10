import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  persistDraftSave,
  completeDraftSave,
  rejectDraftSave,
  captureEditorSave,
} from "../packages/renderer/src/shared/services/draft-save-lifecycle.ts";
import { applyCommitDraftForSave } from "../packages/renderer/src/shared/store/slices/editor-drafts/editor-drafts-transitions.ts";
import {
  draftFromScript,
  bumpDraftRevision,
} from "../packages/renderer/src/shared/store/slices/editor-drafts/state.editor-drafts.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

let nextId = 0;
function harness() {
  const script = buildUserscriptFixture({ id: `save-${++nextId}` });
  const state = {
    userscripts: { scripts: { [script.id]: script } },
    editorDrafts: {
      drafts: { [script.id]: draftFromScript(script) },
      pendingConflicts: {},
    },
  };
  let stored = structuredClone(script);
  let artifact = null;
  const calls = [];
  const context = {
    format: async (code) => code,
    getState: () => state,
    sourceStorage: {
      getAllScripts: async () =>
        stored ? { [script.id]: structuredClone(stored) } : {},
      updateScript: async (_id, value) => {
        calls.push("source");
        stored = structuredClone(value);
      },
      saveScript: async (value) => {
        calls.push("create");
        stored = structuredClone(value);
      },
    },
    compiledStorage: {
      getCompiledCode: async () => artifact,
      saveCompiledCode: async (_id, value) => {
        calls.push("artifact");
        artifact = value;
      },
    },
    compile: async (value) => {
      calls.push("compile");
      return {
        javascript: `compiled:${value.code.source.typescript}`,
        css: value.code.source.scss,
      };
    },
    apply: async () => {
      calls.push("apply");
      return {
        success: true,
        appliedTabCount: 2,
        removedTabCount: 0,
        staleSkipCount: 1,
      };
    },
    commit: (payload) => {
      calls.push(`commit:${payload.buffer}`);
      applyCommitDraftForSave(
        state.editorDrafts.drafts[payload.scriptId],
        payload.buffer,
        payload.code,
        payload.saveRequestId,
        payload.snapshotCode
      );
    },
  };
  const save = async (args = {}, requestId = "save-1") => {
    try {
      const result = await persistDraftSave(
        { scriptId: script.id, ...args },
        { ...context, requestId }
      );
      completeDraftSave(
        state.editorDrafts,
        result.script,
        requestId,
        result.conflictId
      );
      state.userscripts.scripts[script.id] = result.script;
      return result;
    } catch (error) {
      rejectDraftSave(state.editorDrafts, script.id, requestId);
      throw error;
    }
  };
  return {
    script,
    state,
    context,
    calls,
    save,
    get draft() {
      return state.editorDrafts.drafts[script.id];
    },
    get stored() {
      return stored;
    },
    clearStored() {
      stored = null;
    },
    get artifact() {
      return artifact;
    },
  };
}

describe("draft save lifecycle", () => {
  it("commits all buffers before sync, then persists artifacts and applies", async () => {
    const h = harness();
    h.draft.typescript = "const draft = 1;";
    h.draft.scss = ".draft {}";
    h.draft.typeDefinitions = "export type Draft = number;";
    h.draft.dirty.typescript = true;
    const original = structuredClone(h.script);
    h.context.format = async () => "const draft = 1;\n";
    const result = await h.save({
      focusedBuffer: {
        buffer: "typescript",
        code: h.draft.typescript,
        autoFormat: true,
      },
    });
    assert.deepEqual(h.calls, [
      "compile",
      "commit:typescript",
      "commit:scss",
      "commit:typeDefinitions",
      "source",
      "artifact",
      "apply",
    ]);
    assert.equal(h.stored.code.source.typescript, "const draft = 1;\n");
    assert.equal(h.stored.typeDefinitions, "export type Draft = number;");
    assert.deepEqual(h.stored.code.compiled, { javascript: "", css: "" });
    assert.equal(result.script.code.compiled.javascript, h.artifact.javascript);
    assert.deepEqual(h.draft.dirty, {
      typescript: false,
      scss: false,
      typeDefinitions: false,
    });
    assert.equal(result.appliedTabCount, 2);
    assert.equal(result.staleSkipCount, 1);
    assert.deepEqual(h.script, original);
  });

  it("types-only saves tolerate self-import resolution errors and skip compile/apply", async () => {
    const h = harness();
    h.draft.typescript = 'import "scripts/test-script/main";';
    h.draft.typeDefinitions = "export type X = number;";
    await h.save({ compile: false, applyTabs: false });
    assert.deepEqual(h.calls, [
      "commit:typescript",
      "commit:scss",
      "commit:typeDefinitions",
      "source",
    ]);
    assert.equal(h.stored.typeDefinitions, "export type X = number;");
  });

  it("does not commit or write when compilation fails", async () => {
    const h = harness();
    h.draft.typescript = "broken";
    h.draft.dirty.typescript = true;
    h.context.compile = async () => {
      throw Error("compile failed");
    };
    await assert.rejects(h.save(), /compile failed/);
    assert.equal(h.draft.typescript, "broken");
    assert.equal(h.draft.dirty.typescript, true);
    assert.deepEqual(h.draft.lastSaveRequestId, {});
    assert.deepEqual(h.calls, []);
  });

  it("restores dirty on a failed sync write, without artifact or apply effects", async () => {
    const h = harness();
    h.context.sourceStorage.updateScript = async () => {
      throw Error("quota");
    };
    await assert.rejects(h.save(), /quota/);
    assert.deepEqual(h.draft.dirty, {
      typescript: true,
      scss: true,
      typeDefinitions: true,
    });
    assert.ok(!h.calls.includes("artifact"));
    assert.ok(!h.calls.includes("apply"));
  });

  it("keeps save ownership through a storage echo so artifact failure restores dirty", async () => {
    const h = harness();
    const write = h.context.sourceStorage.updateScript;
    h.context.sourceStorage.updateScript = async (id, value) => {
      await write(id, value);
      h.state.editorDrafts.drafts[id] = bumpDraftRevision(h.draft, value);
    };
    h.context.compiledStorage.saveCompiledCode = async () => {
      throw Error("local failed");
    };
    await assert.rejects(h.save(), /local failed/);
    assert.equal(h.draft.lastSaveRequestId.typescript, "save-1");
    assert.equal(h.draft.dirty.typescript, true);
  });

  it("preserves edits to every buffer while compilation is pending", async () => {
    const h = harness();
    const entered = deferred(),
      compile = deferred();
    h.context.compile = () => {
      entered.resolve();
      return compile.promise;
    };
    const saving = h.save();
    await entered.promise;
    for (const buffer of ["typescript", "scss", "typeDefinitions"]) {
      h.draft[buffer] = `new ${buffer}`;
      h.draft.dirty[buffer] = true;
    }
    compile.resolve({ javascript: "compiled old", css: "" });
    await saving;
    for (const buffer of ["typescript", "scss", "typeDefinitions"]) {
      assert.equal(h.draft[buffer], `new ${buffer}`);
      assert.equal(h.draft.dirty[buffer], true);
    }
    assert.equal(
      h.stored.code.source.typescript,
      h.script.code.source.typescript
    );
    assert.equal(
      h.draft.lastSynced.typescript,
      h.stored.code.source.typescript
    );
  });

  it("preserves edits made after commit and before apply finishes", async () => {
    const h = harness();
    const entered = deferred(),
      apply = deferred();
    h.context.apply = () => {
      entered.resolve();
      return apply.promise;
    };
    const saving = h.save();
    await entered.promise;
    h.draft.typescript = "typed during apply";
    h.draft.dirty.typescript = true;
    apply.resolve({ success: true, appliedTabCount: 0 });
    await saving;
    assert.equal(h.draft.typescript, "typed during apply");
    assert.equal(h.draft.dirty.typescript, true);
  });

  it("serializes saves for one script so an older compile cannot publish last", async () => {
    const h = harness();
    const entered = deferred(),
      compile = deferred();
    let compiles = 0;
    h.context.compile = async (script) => {
      compiles++;
      if (compiles === 1) {
        entered.resolve();
        await compile.promise;
      }
      return { javascript: script.code.source.typescript, css: "" };
    };
    h.draft.typescript = "A";
    const a = h.save({}, "A");
    await entered.promise;
    h.draft.typescript = "B";
    h.draft.dirty.typescript = true;
    const b = h.save({}, "B");
    await Promise.resolve();
    assert.equal(compiles, 1);
    compile.resolve();
    await Promise.all([a, b]);
    assert.equal(h.stored.code.source.typescript, "B");
    assert.equal(h.artifact.javascript, "B");
    assert.equal(h.draft.typescript, "B");
    assert.equal(h.draft.dirty.typescript, false);
  });

  it("allows another script to save while the first script is compiling", async () => {
    const a = harness(),
      b = harness(),
      entered = deferred(),
      compile = deferred();
    a.context.compile = () => {
      entered.resolve();
      return compile.promise;
    };
    const saving = a.save();
    await entered.promise;
    await b.save();
    assert.ok(b.calls.includes("apply"));
    compile.resolve({ javascript: "A", css: "" });
    await saving;
  });

  it("runs the next queued save after a failed save", async () => {
    const h = harness(),
      entered = deferred(),
      compile = deferred();
    let count = 0;
    h.context.compile = async () => {
      if (++count === 1) {
        entered.resolve();
        await compile.promise;
        throw Error("first failed");
      }
      return { javascript: "B", css: "" };
    };
    const first = h.save({}, "A");
    const firstRejected = assert.rejects(first, /first failed/);
    await entered.promise;
    h.draft.typescript = "B";
    const second = h.save({}, "B");
    compile.resolve();
    await firstRejected;
    await second;
    assert.equal(h.stored.code.source.typescript, "B");
  });

  it("does not overwrite an edit made during formatting", async () => {
    const h = harness();
    h.draft.typescript = "newer edit";
    h.draft.dirty.typescript = true;
    h.context.format = async () => "formatted old";
    await h.save({
      focusedBuffer: { buffer: "typescript", code: "old", autoFormat: true },
    });
    assert.equal(h.stored.code.source.typescript, "formatted old");
    assert.equal(h.draft.typescript, "newer edit");
    assert.equal(h.draft.dirty.typescript, true);
  });

  it("ignores a superseded completion and rejection", () => {
    const h = harness();
    h.draft.typescript = "new";
    h.draft.lastSynced.typescript = "new";
    h.draft.lastSaveRequestId = {
      typescript: "new",
      scss: "new",
      typeDefinitions: "new",
    };
    completeDraftSave(h.state.editorDrafts, h.script, "old");
    rejectDraftSave(h.state.editorDrafts, h.script.id, "old");
    assert.equal(h.draft.typescript, "new");
    assert.equal(h.draft.dirty.typescript, false);
  });

  it("reports apply failure without rolling back persisted source", async () => {
    const h = harness();
    h.context.apply = async () => ({ success: false, appliedTabCount: 0 });
    const result = await h.save();
    assert.equal(result.applySuccess, false);
    assert.equal(h.draft.dirty.typescript, false);
    assert.ok(h.artifact);
  });

  it("creates a stored source from a local entity", async () => {
    const h = harness();
    h.clearStored();
    await h.save();
    assert.ok(h.calls.includes("create"));
    assert.equal(
      h.stored.code.source.typescript,
      h.script.code.source.typescript
    );
  });

  it("rejects missing drafts and duplicate module paths without writing", async () => {
    const h = harness();
    delete h.state.editorDrafts.drafts[h.script.id];
    await assert.rejects(h.save(), /No editor draft/);
    const d = harness();
    d.context.sourceStorage.getAllScripts = async () => ({
      [d.script.id]: d.script,
      other: buildUserscriptFixture({ id: "other" }),
    });
    await assert.rejects(d.save(), /already used/);
    assert.deepEqual(d.calls, []);
  });
});

function editorHarness() {
  const model = {
    text: "old",
    version: 1,
    disposed: false,
    getValue() {
      return this.text;
    },
    getVersionId() {
      return this.version;
    },
    isDisposed() {
      return this.disposed;
    },
    getFullModelRange() {
      return { startLineNumber: 1, endLineNumber: 1 };
    },
  };
  const edits = [];
  const selections = [{ line: 1 }];
  let current = model;
  const editor = {
    getModel: () => current,
    getSelections: () => selections,
    executeEdits: (source, changes, cursor) => {
      edits.push({ source, changes, cursor });
      current.text = changes[0].text;
      current.version++;
    },
  };
  return {
    model,
    editor,
    edits,
    selections,
    switchModel() {
      current = { ...model, text: "other", version: 1 };
      return current;
    },
  };
}

describe("editor save identity", () => {
  it("applies formatting through undo-preserving edits with the current cursor", () => {
    const h = editorHarness();
    captureEditorSave(h.editor)("formatted");
    assert.equal(h.model.text, "formatted");
    assert.equal(h.edits[0].source, "prettier-format");
    assert.equal(h.edits[0].cursor, h.selections);
  });
  it("does not apply delayed formatting to a different model", () => {
    const h = editorHarness(),
      apply = captureEditorSave(h.editor),
      other = h.switchModel();
    apply("formatted old");
    assert.equal(other.text, "other");
    assert.equal(h.edits.length, 0);
  });
  it("does not erase text typed after the save request", () => {
    const h = editorHarness(),
      apply = captureEditorSave(h.editor);
    h.model.text = "typed";
    h.model.version++;
    apply("formatted old");
    assert.equal(h.model.text, "typed");
    assert.equal(h.edits.length, 0);
  });
  it("ignores disposed, detached, and unchanged models", () => {
    const h = editorHarness();
    captureEditorSave(h.editor)("old");
    h.model.disposed = true;
    captureEditorSave(h.editor)("formatted");
    captureEditorSave({ ...h.editor, getModel: () => null })("formatted");
    assert.equal(h.edits.length, 0);
  });
});
