import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCompiledCodeEntry,
  hashUserscriptCompileSources,
  isCompiledArtifactFresh,
} from "../packages/shared/src/compile-metadata.ts";
import {
  publishMetadata,
  rebuildArtifact,
  publishEnabledToggle,
  removePublishedScript,
  publishImportedScript,
  publishNewScript,
} from "../packages/renderer/src/shared/services/userscript-publication.ts";
import { persistDraftSave } from "../packages/renderer/src/shared/services/draft-save-lifecycle.ts";
import { draftFromScript } from "../packages/renderer/src/shared/store/slices/editor-drafts/state.editor-drafts.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
let nextId = 0;
function harness() {
  const script = buildUserscriptFixture({ id: `publication-${++nextId}` });
  const sources = { [script.id]: structuredClone(script) },
    artifacts = {},
    calls = [];
  const state = {
    userscripts: { scripts: { [script.id]: script } },
    editorDrafts: { drafts: { [script.id]: draftFromScript(script) } },
  };
  const compile = async (value) => {
    calls.push(`compile:${value.code.source.typescript}`);
    return buildCompiledCodeEntry(
      `built:${value.code.source.typescript}`,
      value.code.source.scss,
      {
        minifyCompiledOutput: false,
        sourceHash: hashUserscriptCompileSources(value),
      }
    );
  };
  const context = {
    sourceStorage: {
      getAllScripts: async () => structuredClone(sources),
      saveScript: async (value) => {
        calls.push("source");
        sources[value.id] = structuredClone(value);
      },
      updateScript: async (id, value) => {
        calls.push("source");
        sources[id] = { ...sources[id], ...structuredClone(value) };
      },
      deleteScript: async (id) => {
        calls.push("delete-source");
        delete sources[id];
      },
    },
    compiledStorage: {
      getCompiledCode: async (id) => artifacts[id],
      saveCompiledCode: async (id, value) => {
        calls.push("artifact");
        artifacts[id] = structuredClone(value);
      },
      deleteCompiledCode: async (id) => {
        calls.push("delete-artifact");
        delete artifacts[id];
      },
    },
    getLocalScripts: () => state.userscripts.scripts,
    getBuildOptions: () => ({ minifyCompiledOutput: false }),
    compileAll: compile,
    compileJavascript: async () => "javascript",
  };
  const save = () =>
    persistDraftSave(
      { scriptId: script.id, applyTabs: false },
      {
        ...context,
        requestId: "save",
        getState: () => state,
        compile: (value) => context.compileAll(value),
        commit: () => calls.push("commit"),
        apply: async () => ({ success: true, appliedTabCount: 0 }),
      }
    );
  return {
    script,
    id: script.id,
    sources,
    artifacts,
    state,
    calls,
    context,
    save,
  };
}

describe("userscript publication", () => {
  it("holds ownership through a delayed rebuild freshness read so a later draft wins", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    const getAll = h.context.sourceStorage.getAllScripts;
    let reads = 0;
    h.context.sourceStorage.getAllScripts = async () => {
      const snapshot = await getAll();
      if (++reads === 2) {
        entered.resolve();
        await release.promise;
      }
      return snapshot;
    };
    const rebuild = rebuildArtifact(h.id, "all", h.context);
    await entered.promise;
    h.state.editorDrafts.drafts[h.id].typescript = "new draft";
    const save = h.save();
    await tick();
    assert.equal(h.sources[h.id].code.source.typescript, "export {};");
    release.resolve();
    await Promise.all([rebuild, save]);
    assert.equal(h.sources[h.id].code.source.typescript, "new draft");
    assert.equal(h.artifacts[h.id].javascript, "built:new draft");
    assert.equal(
      isCompiledArtifactFresh(h.sources[h.id], h.artifacts[h.id], false),
      true
    );
  });

  it("rereads source after entering a queued rebuild", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    const compile = h.context.compileAll;
    h.context.compileAll = async (value) => {
      entered.resolve();
      await release.promise;
      return compile(value);
    };
    h.state.editorDrafts.drafts[h.id].typescript = "saved first";
    const save = h.save();
    await entered.promise;
    const rebuild = rebuildArtifact(h.id, "stale", h.context);
    release.resolve();
    await save;
    assert.equal(await rebuild, undefined);
    assert.equal(
      h.calls.filter((value) => value.startsWith("compile:")).length,
      1
    );
  });

  it("metadata and toggle merge with a preceding draft save", async () => {
    const h = harness();
    h.state.editorDrafts.drafts[h.id].typescript = "new source";
    await Promise.all([
      h.save(),
      publishMetadata(h.id, { name: "renamed" }, h.context),
      publishEnabledToggle(h.id, h.context.sourceStorage),
    ]);
    assert.equal(h.sources[h.id].name, "renamed");
    assert.equal(h.sources[h.id].enabled, false);
    assert.equal(h.sources[h.id].code.source.typescript, "new source");
    assert.equal(
      isCompiledArtifactFresh(h.sources[h.id], h.artifacts[h.id], false),
      true
    );
  });

  it("delete waits for an in-flight rebuild and removes its artifact", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    const compile = h.context.compileAll;
    h.context.compileAll = async (value) => {
      entered.resolve();
      await release.promise;
      return compile(value);
    };
    const rebuild = rebuildArtifact(h.id, "all", h.context);
    await entered.promise;
    const remove = removePublishedScript(
      h.id,
      h.context.sourceStorage,
      h.context.compiledStorage
    );
    release.resolve();
    await Promise.all([rebuild, remove]);
    assert.equal(h.sources[h.id], undefined);
    assert.equal(h.artifacts[h.id], undefined);
    assert.equal(await rebuildArtifact(h.id, "all", h.context), undefined);
  });

  it("metadata compiles stale artifacts before source persistence and ignores source patches", async () => {
    const h = harness();
    const result = await publishMetadata(
      h.id,
      {
        name: "renamed",
        code: { source: { typescript: "discard", scss: "discard" } },
        typeDefinitions: "discard",
      },
      h.context
    );
    assert.equal(result.name, "renamed");
    assert.equal(result.code.source.typescript, "export {};");
    assert.equal(result.typeDefinitions, "");
    assert.deepEqual(h.calls, ["compile:export {};", "artifact", "source"]);
    assert.equal(h.sources[h.id].code.compiled.javascript, "");
  });

  it("metadata retains a source changed externally during compilation without publishing its obsolete artifact", async () => {
    const h = harness(),
      compile = h.context.compileAll;
    h.context.compileAll = async (value) => {
      const result = await compile(value);
      h.sources[h.id].code.source.typescript = "external source";
      return result;
    };
    const result = await publishMetadata(h.id, { name: "renamed" }, h.context);
    assert.equal(result.code.source.typescript, "external source");
    assert.equal(h.sources[h.id].name, "renamed");
    assert.equal(h.artifacts[h.id], undefined);
  });

  it("metadata rejects duplicate module paths before compilation or publication", async () => {
    const h = harness();
    h.sources.other = buildUserscriptFixture({
      id: "other",
      moduleName: "occupied",
    });
    await assert.rejects(
      publishMetadata(h.id, { moduleName: "occupied" }, h.context),
      /already used/
    );
    assert.deepEqual(h.calls, []);
  });

  it("failed metadata publication releases ownership for a later draft", async () => {
    const h = harness(),
      compile = h.context.compileAll;
    h.context.compileAll = async () => {
      throw new Error("bad compile");
    };
    await assert.rejects(
      publishMetadata(h.id, { name: "failed" }, h.context),
      /bad compile/
    );
    h.context.compileAll = compile;
    h.state.editorDrafts.drafts[h.id].typescript = "recovered";
    await h.save();
    assert.equal(h.artifacts[h.id].javascript, "built:recovered");
  });

  it("retains external source freshness checks", async () => {
    const h = harness(),
      compile = h.context.compileAll;
    h.context.compileAll = async (value) => {
      const artifact = await compile(value);
      h.sources[h.id].code.source.typescript = "external window";
      return artifact;
    };
    assert.equal(await rebuildArtifact(h.id, "all", h.context), undefined);
    assert.equal(h.artifacts[h.id], undefined);
  });

  it("independent scripts can publish while another script is compiling", async () => {
    const a = harness(),
      b = harness(),
      entered = deferred(),
      release = deferred();
    const compile = a.context.compileAll;
    a.context.compileAll = async (value) => {
      entered.resolve();
      await release.promise;
      return compile(value);
    };
    const pending = rebuildArtifact(a.id, "all", a.context);
    await entered.promise;
    await b.save();
    assert.ok(b.artifacts[b.id]);
    release.resolve();
    await pending;
  });

  it("initial import publication owns both writes before a queued rebuild", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    const write = h.context.sourceStorage.saveScript;
    h.context.sourceStorage.saveScript = async (script) => {
      entered.resolve();
      await release.promise;
      await write(script);
    };
    const artifact = await h.context.compileAll(h.script);
    const imported = publishImportedScript(h.script, artifact, h.context);
    await entered.promise;
    const rebuild = rebuildArtifact(h.id, "stale", h.context);
    release.resolve();
    await imported;
    assert.equal(await rebuild, undefined);
  });

  it("failed import waits for its sibling write before releasing ownership", async () => {
    const h = harness(),
      entered = deferred(),
      release = deferred();
    const writeArtifact = h.context.compiledStorage.saveCompiledCode;
    h.context.sourceStorage.saveScript = async () => {
      throw new Error("source failed");
    };
    h.context.compiledStorage.saveCompiledCode = async (id, value) => {
      entered.resolve();
      await release.promise;
      await writeArtifact(id, value);
    };
    const artifact = await h.context.compileAll(h.script);
    const rejected = assert.rejects(
      publishImportedScript(h.script, artifact, h.context),
      /source failed/
    );
    await entered.promise;
    let reads = 0;
    const getAll = h.context.sourceStorage.getAllScripts;
    h.context.sourceStorage.getAllScripts = async () => {
      reads++;
      return getAll();
    };
    const rebuild = rebuildArtifact(h.id, "stale", h.context);
    await tick();
    assert.equal(reads, 0);
    release.resolve();
    await rejected;
    await rebuild;
    assert.equal(reads, 1);
  });

  it("new script seed failure remains best effort after source persistence", async () => {
    const h = harness(),
      warning = console.warn;
    console.warn = () => {};
    try {
      await publishNewScript(h.script, h.context, async () => {
        throw new Error("settings unavailable");
      });
    } finally {
      console.warn = warning;
    }
    assert.deepEqual(h.calls, ["source"]);
    assert.ok(h.sources[h.id]);
  });
});

describe("deleted publication fallback", () => {
  it("remembers successful source deletion even if artifact deletion fails", async () => {
    const h = harness();
    h.context.compiledStorage.deleteCompiledCode = async () => {
      throw Error("artifact deletion failed");
    };
    await assert.rejects(
      removePublishedScript(
        h.id,
        h.context.sourceStorage,
        h.context.compiledStorage
      ),
      /artifact deletion failed/
    );
    await assert.rejects(h.save(), /Userscript not found/);
    await assert.rejects(
      publishMetadata(h.id, { name: "late" }, h.context),
      /Userscript not found/
    );
    assert.equal(h.sources[h.id], undefined);
  });
  it("allows existing externally restored source and explicit creation after deletion", async () => {
    const h = harness();
    await removePublishedScript(
      h.id,
      h.context.sourceStorage,
      h.context.compiledStorage
    );
    h.sources[h.id] = structuredClone(h.script);
    await h.save();
    assert.ok(h.sources[h.id]);
    await removePublishedScript(
      h.id,
      h.context.sourceStorage,
      h.context.compiledStorage
    );
    await publishNewScript(h.script, h.context, async () => ({
      minifyCompiledOutput: false,
    }));
    await h.save();
    assert.ok(h.sources[h.id]);
  });
  it("retains the intentional local-only draft save path", async () => {
    const h = harness();
    delete h.sources[h.id];
    await h.save();
    assert.ok(h.sources[h.id]);
  });
  it("does not recreate source deleted externally during a draft or metadata compile", async () => {
    for (const kind of ["draft", "metadata"]) {
      const h = harness(),
        compile = h.context.compileAll;
      h.context.compileAll = async (script) => {
        const result = await compile(script);
        delete h.sources[h.id];
        return result;
      };
      await assert.rejects(
        kind === "draft"
          ? h.save()
          : publishMetadata(h.id, { name: "metadata" }, h.context),
        /Userscript not found/
      );
      assert.equal(h.sources[h.id], undefined);
      assert.equal(h.calls.includes("commit"), false);
    }
  });
});
