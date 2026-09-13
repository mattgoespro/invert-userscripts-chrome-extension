import assert from "node:assert/strict";
import test from "node:test";
import {
  createCompiledCodeBuildMetadata,
  getCompiledOutputBuildOptions,
  hashUserscriptCompileSources,
  isCompiledArtifactFresh,
  isCompiledCodeBuildCurrent,
  isUserscriptCompileSnapshotStale,
} from "../packages/renderer/src/sandbox/compiled-build-metadata.ts";

test("getCompiledOutputBuildOptions defaults minifyCompiledOutput to false", () => {
  assert.deepEqual(getCompiledOutputBuildOptions({}), {
    minifyCompiledOutput: false,
  });
  assert.deepEqual(
    getCompiledOutputBuildOptions({ minifyCompiledOutput: true }),
    { minifyCompiledOutput: true }
  );
});

test("isCompiledCodeBuildCurrent requires matching version and minify flag", () => {
  const options = { minifyCompiledOutput: true };
  const current = createCompiledCodeBuildMetadata(options);

  assert.equal(isCompiledCodeBuildCurrent(null, options), false);
  assert.equal(
    isCompiledCodeBuildCurrent(
      { javascript: "x", css: "", build: current },
      options
    ),
    true
  );
  assert.equal(
    isCompiledCodeBuildCurrent(
      {
        javascript: "x",
        css: "",
        build: { version: 1, minifyCompiledOutput: false },
      },
      options
    ),
    false
  );
  assert.equal(
    isCompiledCodeBuildCurrent(
      {
        javascript: "x",
        css: "",
        build: { version: 2, minifyCompiledOutput: true },
      },
      options
    ),
    false
  );
  assert.equal(
    isCompiledCodeBuildCurrent({ javascript: "x", css: "" }, options),
    false
  );
});

test("isCompiledCodeBuildCurrent requires a matching sourceHash when provided", () => {
  const options = {
    minifyCompiledOutput: false,
    sourceHash: "abc",
  };
  const current = createCompiledCodeBuildMetadata(options);

  assert.equal(
    isCompiledCodeBuildCurrent(
      { javascript: "x", css: "", build: current },
      options
    ),
    true
  );
  assert.equal(
    isCompiledCodeBuildCurrent(
      {
        javascript: "x",
        css: "",
        build: {
          version: 1,
          minifyCompiledOutput: false,
          sourceHash: "other",
        },
      },
      options
    ),
    false
  );
  assert.equal(
    isCompiledCodeBuildCurrent(
      {
        javascript: "x",
        css: "",
        build: { version: 1, minifyCompiledOutput: false },
      },
      options
    ),
    false
  );
});

test("hashUserscriptCompileSources changes when TypeScript source changes", () => {
  const script = {
    id: "a",
    shared: false,
    moduleName: "a",
    code: { source: { typescript: "const x = 1;", scss: "" } },
  };

  const original = hashUserscriptCompileSources(script);
  const changed = hashUserscriptCompileSources({
    ...script,
    code: { source: { typescript: "const x = 2;", scss: "" } },
  });

  assert.equal(typeof original, "string");
  assert.notEqual(original, changed);
});

test("isUserscriptCompileSnapshotStale detects deleted or source-changed scripts", () => {
  const snapshot = {
    id: "a",
    shared: false,
    moduleName: "a",
    code: { source: { typescript: "const x = 1;", scss: "" } },
  };

  assert.equal(isUserscriptCompileSnapshotStale(snapshot, null), true);
  assert.equal(isUserscriptCompileSnapshotStale(snapshot, snapshot), false);
  assert.equal(
    isUserscriptCompileSnapshotStale(snapshot, {
      ...snapshot,
      code: { source: { typescript: "const x = 2;", scss: "" } },
    }),
    true
  );
});

test("isCompiledArtifactFresh treats a missing sourceHash as stale", () => {
  const script = {
    id: "a",
    shared: false,
    moduleName: "a",
    code: { source: { typescript: "const x = 1;", scss: "" } },
  };
  const sourceHash = hashUserscriptCompileSources(script);

  assert.equal(isCompiledArtifactFresh(script, null), false);
  assert.equal(
    isCompiledArtifactFresh(script, { javascript: "x", css: "" }),
    false
  );
  assert.equal(
    isCompiledArtifactFresh(script, {
      javascript: "x",
      css: "",
      build: { version: 1, minifyCompiledOutput: false },
    }),
    false
  );
  assert.equal(
    isCompiledArtifactFresh(script, {
      javascript: "x",
      css: "",
      build: {
        version: 1,
        minifyCompiledOutput: false,
        sourceHash,
      },
    }),
    true
  );
  assert.equal(
    isCompiledArtifactFresh(script, {
      javascript: "x",
      css: "",
      build: {
        version: 1,
        minifyCompiledOutput: false,
        sourceHash: "other",
      },
    }),
    false
  );
});

test("isCompiledArtifactFresh requires matching minify when that flag is provided", () => {
  const script = {
    id: "a",
    shared: false,
    moduleName: "a",
    code: { source: { typescript: "const x = 1;", scss: "" } },
  };
  const sourceHash = hashUserscriptCompileSources(script);
  const entry = {
    javascript: "x",
    css: "",
    build: {
      version: 1,
      minifyCompiledOutput: true,
      sourceHash,
    },
  };

  assert.equal(isCompiledArtifactFresh(script, entry), true);
  assert.equal(isCompiledArtifactFresh(script, entry, true), true);
  assert.equal(isCompiledArtifactFresh(script, entry, false), false);
});
