import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import vm from "node:vm";
import {
  prepareCompiledJavascript,
  wrapSharedScriptForInjection,
} from "../packages/shared/src/compiled-output.ts";
import { resolveEditorTheme } from "../packages/shared/src/editor-theme.ts";
import { getSharedImportModuleNames } from "../packages/shared/src/shared-module-imports.ts";
import {
  enableDriveState,
  captureDriveScript,
  mergeDriveRecords,
} from "../packages/shared/src/storage/drive-sync.ts";
import { emptyRepositoryState } from "../packages/shared/src/storage/document-repository.ts";
import { GlobalStateManager } from "../packages/shared/src/storage/global-state.storage.ts";
import { migrateLegacyDocuments } from "../packages/shared/src/storage/indexeddb/migration.ts";
import { mergeSyncRevision } from "../packages/shared/src/storage/sync/replication.ts";
import {
  decodeSyncRevision,
  encodeSyncRevision,
} from "../packages/shared/src/storage/sync/revision-codec.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";

function runShared(moduleName, source, globals = {}) {
  const window = {};
  vm.runInNewContext(wrapSharedScriptForInjection(moduleName, source), {
    window,
    ...globals,
  });
  return window.__INVERT_SHARED__[moduleName];
}

test("resolveEditorTheme falls back to the app theme for removed themes", () => {
  assert.equal(resolveEditorTheme("dracula", "obsidian"), "invert-obsidian");
  assert.equal(resolveEditorTheme("dracula", undefined), "invert-matte-grey");
  assert.equal(resolveEditorTheme("constructor", "basalt"), "invert-basalt");
  assert.equal(
    resolveEditorTheme("invert-removed-theme", "basalt"),
    "invert-basalt"
  );
});

test("resolveEditorTheme keeps every theme Monaco registers", async () => {
  const { EditorThemes } = await import("../packages/monaco/src/theming.ts");
  for (const name of Object.keys(EditorThemes)) {
    assert.equal(resolveEditorTheme(name, "obsidian"), name);
  }
  assert.equal(resolveEditorTheme("match-app", "obsidian"), "invert-obsidian");
  assert.equal(resolveEditorTheme(undefined, "obsidian"), "invert-obsidian");
});

test("encodeSyncRevision treats an explicit undefined script as a tombstone", async () => {
  const encoded = await encodeSyncRevision(
    { id: "gone", revision: "r2", parents: ["r1"], script: undefined },
    ["r1"]
  );
  assert.equal(encoded.manifest.deleted, true);
  assert.equal(encoded.manifest.id, "gone");
  const decoded = await decodeSyncRevision(encoded.manifest, encoded.chunks);
  assert.equal(decoded.status, "complete");
  assert.equal(decoded.document, null);
});

test("mergeSyncRevision walks very long histories without overflowing", () => {
  const records = {};
  const length = 200_000;
  for (let index = 0; index < length; index++) {
    const revision = "r" + index;
    records[revision] = {
      revision,
      parents: index ? ["r" + (index - 1)] : [],
    };
  }
  const head = "r" + (length - 1);
  assert.deepEqual(
    mergeSyncRevision([head], { revision: "next", parents: [head] }, records),
    { status: "advance", heads: ["next"] }
  );
  assert.deepEqual(
    mergeSyncRevision([head], { revision: "fork", parents: ["r0"] }, records),
    { status: "conflict", heads: [head, "fork"] }
  );
});

test("mergeSyncRevision terminates on cyclic ancestry", () => {
  const records = {
    a: { revision: "a", parents: ["b"] },
    b: { revision: "b", parents: ["a"] },
  };
  assert.equal(
    mergeSyncRevision(["a"], { revision: "c", parents: [] }, records).status,
    "conflict"
  );
});

test("shared wrapper exports every name bound by a destructuring declaration", () => {
  const ns = runShared(
    "destructure",
    [
      "const o = { a: 1, b: { c: 2 }, d: undefined, e: 5, f: 6 };",
      "const list = [7, 8, 9];",
      "export const { a, b: { c }, d = 4, ...rest } = o;",
      "export const [first, , third] = list;",
      "export const plain = 10;",
    ].join("\n")
  );
  assert.equal(ns.a, 1);
  assert.equal(ns.c, 2);
  assert.equal(ns.d, 4);
  assert.deepEqual({ ...ns.rest }, { e: 5, f: 6 });
  assert.equal(ns.first, 7);
  assert.equal(ns.third, 9);
  assert.equal(ns.plain, 10);
  assert.equal("b" in ns, false);
});

test("classic scripts accept an object literal default export", () => {
  const result = prepareCompiledJavascript(
    "export default { a: 1, b: 2 };\nglobalThis.ran = true;",
    {}
  );
  const context = {};
  vm.runInNewContext(result, context);
  assert.equal(context.ran, true);
});

for (const declaration of ["function() { return 1; }", "class {}"]) {
  test(`an anonymous default ${declaration} does not swallow a following IIFE`, () => {
    const source = [
      `export default ${declaration}`,
      "(function() { globalThis.ran = true; })();",
    ].join("\n");

    const classic = {};
    vm.runInNewContext(prepareCompiledJavascript(source, {}), classic);
    assert.equal(classic.ran, true);

    const ns = runShared("anon", source);
    assert.equal(typeof ns.default, "function");
  });
}

test("getSharedImportModuleNames finds multi-line imports", () => {
  const sourceCode = [
    "import {",
    "  first,",
    "  second as renamed,",
    '} from "scripts/multi/main";',
    "import fallback, {",
    "  third,",
    '} from "scripts/mixed-multi/main";',
    "export {",
    "  fourth,",
    '} from "scripts/reexport/main";',
    "import type {",
    "  Shape,",
    '} from "scripts/types-only/main";',
  ].join("\n");
  assert.deepEqual(getSharedImportModuleNames(sourceCode).sort(), [
    "mixed-multi",
    "multi",
    "reexport",
  ]);
});

test("getSharedImportModuleNames is not affected by later comments", () => {
  const sourceCode = [
    'import one from "scripts/one/main";',
    "// this helper is type only",
    "/* also type only */",
    'import two from "scripts/two/main";',
  ].join("\n");
  assert.deepEqual(getSharedImportModuleNames(sourceCode), ["one", "two"]);
});

test("getSharedImportModuleNames skips commented-out imports", () => {
  const sourceCode = [
    '// import a from "scripts/line/main";',
    "/*",
    'import b from "scripts/block/main";',
    'import("scripts/block-dynamic/main");',
    "*/",
    'import c /* inline */ from "scripts/kept/main"; // trailing',
    'const url = "https://example.com/*";',
    "const pattern = /\\/*/;",
    'import d from "scripts/after-strings/main";',
  ].join("\n");
  assert.deepEqual(getSharedImportModuleNames(sourceCode), [
    "kept",
    "after-strings",
  ]);
});

test("getSharedImportModuleNames does not let a statement absorb a type import", () => {
  const sourceCode = [
    "export class Local {}",
    'import type { Shape } from "scripts/types-only/main";',
    "export const value = 1",
    'import type { Other } from "scripts/other-types/main";',
    'import type from "scripts/named-type/main";',
    'import a from "./local"; import b from "scripts/same-line/main";',
  ].join("\n");
  assert.deepEqual(getSharedImportModuleNames(sourceCode).sort(), [
    "named-type",
    "same-line",
  ]);
});

function installChrome(local = {}, sync = {}) {
  const read = (store, keys) => {
    if (keys === null) {
      return { ...store };
    }
    const names = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      names.filter((name) => name in store).map((name) => [name, store[name]])
    );
  };
  globalThis.chrome = {
    storage: {
      local: {
        get: async (keys) => read(local, keys),
        set: async (items) => {
          Object.assign(local, items);
        },
        remove: async (keys) => {
          for (const key of [keys].flat()) {
            delete local[key];
          }
        },
      },
      sync: { get: async (keys) => read(sync, keys) },
    },
  };
  return local;
}
function installSession(id) {
  const store = new Map(id ? [["invert-layout-session", id]] : []);
  globalThis.sessionStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
}
afterEach(() => {
  delete globalThis.chrome;
  delete globalThis.sessionStorage;
});

test("a new transactional tab restores the last saved layout, not the sync value", async () => {
  installChrome(
    {
      publicationBackend: "transactional",
      "globalState:last": { activeSidebarTab: "settings" },
    },
    { globalState: { activeSidebarTab: "modules" } }
  );
  installSession();
  const state = await GlobalStateManager.get();
  assert.equal(state.activeSidebarTab, "settings");
});

test("a new transactional tab still seeds from sync without a last layout", async () => {
  installChrome(
    { publicationBackend: "transactional" },
    { globalState: { activeSidebarTab: "modules" } }
  );
  installSession();
  assert.equal((await GlobalStateManager.get()).activeSidebarTab, "modules");
});

test("a saved layout survives closing the tab", async () => {
  const local = installChrome({ publicationBackend: "transactional" });
  installSession();
  await GlobalStateManager.save({ activeSidebarTab: "settings" });
  installSession();
  assert.equal((await GlobalStateManager.get()).activeSidebarTab, "settings");
  assert.equal(local["globalState:last"].activeSidebarTab, "settings");
});

test("per-session layout keys do not accumulate across tab sessions", async () => {
  const local = installChrome({
    publicationBackend: "transactional",
    "globalState:closed-1": { activeSidebarTab: "modules" },
    "globalState:closed-2": { activeSidebarTab: "modules" },
    "globalState:last": { activeSidebarTab: "settings" },
    unrelated: 1,
  });
  installSession("mine");
  await GlobalStateManager.get();
  assert.deepEqual(Object.keys(local).sort(), [
    "globalState:last",
    "globalState:mine",
    "publicationBackend",
    "unrelated",
  ]);
});

test("an existing session keeps its own layout and other sessions' keys", async () => {
  const local = installChrome({
    publicationBackend: "transactional",
    "globalState:mine": { activeSidebarTab: "modules" },
    "globalState:other": { activeSidebarTab: "scripts" },
    "globalState:last": { activeSidebarTab: "settings" },
  });
  installSession("mine");
  assert.equal((await GlobalStateManager.get()).activeSidebarTab, "modules");
  assert.ok(local["globalState:other"]);
});

test("a rejected legacy migration reports why", async () => {
  const scripts = Object.fromEntries(
    ["one", "two"].map((id) => [
      id,
      buildUserscriptFixture({ id, shared: true, moduleName: "same-path" }),
    ])
  );
  let state = emptyRepositoryState();
  const repository = {
    update: async (mutate) => {
      const result = mutate(state);
      state = result.state;
      return result.value;
    },
  };
  await assert.rejects(
    migrateLegacyDocuments(repository, async () => ({
      scripts,
      artifacts: {},
      modules: {},
      settings: {},
    })),
    /Legacy data cannot be migrated: Module path is already used by/
  );
});

const LEGACY = "legacy-" + "a".repeat(64);
const driveScript = buildUserscriptFixture({
  id: "drive-script",
  name: "Legacy",
  moduleName: "drive-script",
});
const legacyRecord = (revision, parents, script = driveScript) => ({
  kind: "script",
  id: "drive-script",
  revision,
  parents,
  script,
});
function driveState() {
  const state = emptyRepositoryState();
  enableDriveState(state);
  return state;
}

test("legacy revisions with different parents merge by unioning ancestry", () => {
  const state = driveState();
  mergeDriveRecords(state, [legacyRecord(LEGACY, ["from-device-a"])]);
  mergeDriveRecords(state, [legacyRecord(LEGACY, ["from-device-b"])]);
  const union = ["from-device-a", "from-device-b"];
  assert.deepEqual(state.drive.records[LEGACY].parents, union);
  assert.deepEqual(state.syncRecords[LEGACY].parents, union);
  assert.deepEqual(state.documents["drive-script"].parents, union);
  assert.deepEqual(state.syncHeads["drive-script"], [LEGACY]);
  assert.deepEqual(state.drive.pending, []);
});

test("duplicate legacy revisions in one batch merge, in either arrival order", () => {
  for (const order of [
    [["a"], ["b"]],
    [["b"], ["a"]],
  ]) {
    const state = driveState();
    mergeDriveRecords(
      state,
      order.map((parents) => legacyRecord(LEGACY, parents))
    );
    assert.deepEqual([...state.drive.records[LEGACY].parents].sort(), [
      "a",
      "b",
    ]);
  }
});

test("unioned legacy parents are all ancestors of the head", () => {
  const state = driveState();
  mergeDriveRecords(state, [
    legacyRecord("older-a", [], { ...driveScript, name: "Older A" }),
    legacyRecord(LEGACY, ["older-a"]),
  ]);
  mergeDriveRecords(state, [
    legacyRecord("older-b", [], { ...driveScript, name: "Older B" }),
    legacyRecord(LEGACY, ["older-b"]),
  ]);
  assert.deepEqual(state.syncHeads["drive-script"], [LEGACY]);
  assert.deepEqual(state.syncConflicts, {});
});

test("a local capture of a legacy revision keeps merged parents", () => {
  const state = driveState();
  mergeDriveRecords(state, [legacyRecord(LEGACY, ["remote-parent"])]);
  state.documents["drive-script"].parents = [];
  captureDriveScript(state, "drive-script");
  assert.deepEqual(state.drive.records[LEGACY].parents, ["remote-parent"]);
});

test("legacy revisions with different content are still rejected", () => {
  const state = driveState();
  mergeDriveRecords(state, [legacyRecord(LEGACY, [])]);
  const before = structuredClone(state);
  assert.throws(
    () =>
      mergeDriveRecords(state, [
        legacyRecord(LEGACY, [], { ...driveScript, name: "Tampered" }),
      ]),
    /identity does not match/
  );
  assert.deepEqual(state, before);
});

test("non-legacy revisions must still match parents exactly", () => {
  const state = driveState();
  mergeDriveRecords(state, [legacyRecord("plain", ["a"])]);
  const before = structuredClone(state);
  assert.throws(
    () => mergeDriveRecords(state, [legacyRecord("plain", ["b"])]),
    /identity does not match/
  );
  assert.deepEqual(state, before);
});

test("a cycle formed by unioned legacy parents is rejected before any change", () => {
  const state = driveState();
  const other = "legacy-" + "b".repeat(64);
  mergeDriveRecords(state, [
    legacyRecord(LEGACY, []),
    legacyRecord(other, [LEGACY], { ...driveScript, name: "Other" }),
  ]);
  const before = structuredClone(state);
  assert.throws(
    () => mergeDriveRecords(state, [legacyRecord(LEGACY, [other])]),
    /cyclic/i
  );
  assert.deepEqual(state, before);
});
