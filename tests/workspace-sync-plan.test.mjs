import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDraftBuffer,
  projectWorkspace,
} from "../packages/renderer/src/shared/services/workspace-sync-plan.ts";
import { draftFromScript } from "../packages/renderer/src/shared/store/slices/editor-drafts/state.editor-drafts.ts";
import {
  buildModuleFixture,
  buildUserscriptFixture,
} from "./helpers/fixtures.mjs";
import { buildScriptFileUri } from "../packages/monaco/src/typescript/model-uris.ts";

describe("getDraftBuffer", () => {
  it("falls back to saved script contents when there is no draft", () => {
    const script = buildUserscriptFixture({
      typeDefinitions: "declare const X: number;",
      code: {
        source: { typescript: "export const a = 1;", scss: ".a{}" },
        compiled: { javascript: "", css: "" },
      },
    });

    assert.deepEqual(getDraftBuffer(script, undefined, "typescript"), {
      contents: "export const a = 1;",
      dirty: false,
    });
    assert.deepEqual(getDraftBuffer(script, undefined, "scss"), {
      contents: ".a{}",
      dirty: false,
    });
    assert.deepEqual(getDraftBuffer(script, undefined, "typeDefinitions"), {
      contents: "declare const X: number;",
      dirty: false,
    });
  });

  it("prefers draft contents and reports dirty for preserveAttachedBuffer", () => {
    const script = buildUserscriptFixture();
    const draft = draftFromScript(script);
    draft.typescript = "export const draft = 1;";
    draft.dirty.typescript = true;

    assert.deepEqual(getDraftBuffer(script, draft, "typescript"), {
      contents: "export const draft = 1;",
      dirty: true,
    });
  });
});

function projectionInput(scripts, overrides = {}) {
  return {
    scripts: Object.fromEntries(scripts.map((script) => [script.id, script])),
    drafts: {},
    modules: {},
    currentScriptId: scripts[0]?.id,
    ...overrides,
  };
}

function files(projection) {
  return projection.models.map(({ script, editor, ...file }) => ({
    uri: buildScriptFileUri(script, editor),
    ...file,
  }));
}

describe("workspace projection", () => {
  it("projects all mains, active ambient types, offscreen exported types, and only active or dirty styles", () => {
    const active = buildUserscriptFixture({
      id: "active",
      moduleName: "active",
      typeDefinitions: "declare const Own: number;",
    });
    const exported = buildUserscriptFixture({
      id: "exported",
      moduleName: "exported",
      typeDefinitions: "export type Public = number;",
    });
    const ambient = buildUserscriptFixture({
      id: "ambient",
      moduleName: "ambient",
      typeDefinitions: "declare const Hidden: number;",
    });
    const dirty = draftFromScript(ambient);
    dirty.scss = ".dirty {}";
    dirty.dirty.scss = true;
    const input = projectionInput([active, exported, ambient], {
      drafts: { ambient: dirty },
    });
    const before = JSON.stringify(input);
    const plan = projectWorkspace(input);
    assert.deepEqual(
      files(plan).map((file) => file.uri),
      [
        "file:///userscripts/active/main.ts",
        "file:///userscripts/active/types.d.ts",
        "file:///userscripts/active/styles.scss",
        "file:///userscripts/exported/main.ts",
        "file:///userscripts/exported/types.d.ts",
        "file:///userscripts/ambient/main.ts",
        "file:///userscripts/ambient/styles.scss",
      ]
    );
    assert.deepEqual(files(plan).at(-1), {
      uri: "file:///userscripts/ambient/styles.scss",
      language: "scss",
      contents: ".dirty {}",
      preserveAttachedBuffer: true,
    });
    assert.deepEqual(plan.modulePaths, ["active", "exported", "ambient"]);
    assert.equal(JSON.stringify(input), before);
  });

  it("scopes CDN types from unsaved transitive imports and dirty drafts, excluding unrelated and orphan drafts", () => {
    const active = buildUserscriptFixture({
      id: "a",
      moduleName: "a",
      globalModules: ["direct"],
    });
    const shared = buildUserscriptFixture({
      id: "s",
      moduleName: "shared",
      shared: true,
      globalModules: ["dependency"],
      code: { source: { typescript: 'import "scripts/nested/main";' } },
    });
    const nested = buildUserscriptFixture({
      id: "n",
      moduleName: "nested",
      shared: true,
      globalModules: ["nested-module"],
    });
    const other = buildUserscriptFixture({
      id: "o",
      moduleName: "other",
      globalModules: ["unrelated"],
    });
    const dirtyScript = buildUserscriptFixture({
      id: "d",
      moduleName: "dirty",
      globalModules: ["dirty-module", "no-package"],
    });
    const activeDraft = draftFromScript(active);
    activeDraft.typescript = 'import "scripts/shared/main";';
    activeDraft.dirty.typescript = true;
    const dirtyDraft = draftFromScript(dirtyScript);
    dirtyDraft.dirty.typeDefinitions = true;
    const modules = Object.fromEntries(
      [
        "direct",
        "dependency",
        "nested-module",
        "unrelated",
        "dirty-module",
      ].map((id) => [id, buildModuleFixture({ id, packageName: id })])
    );
    modules["no-package"] = buildModuleFixture({
      id: "no-package",
      packageName: "",
    });
    const plan = projectWorkspace(
      projectionInput([active, shared, nested, other, dirtyScript], {
        drafts: { a: activeDraft, d: dirtyDraft, orphan: dirtyDraft },
        modules,
      })
    );
    assert.deepEqual(
      plan.cdnModules.map((module) => module.id),
      ["direct", "dependency", "nested-module", "dirty-module"]
    );
    assert.equal(files(plan)[0].contents, activeDraft.typescript);
    assert.equal(files(plan)[0].preserveAttachedBuffer, true);
  });

  it("changes model membership on selection/export edits and preserves the existing signature gate", () => {
    const a = buildUserscriptFixture({ id: "a", moduleName: "a" });
    const b = buildUserscriptFixture({ id: "b", moduleName: "b" });
    const input = projectionInput([a, b]);
    const first = projectWorkspace(input);
    assert.equal(projectWorkspace(input, first.signature), null);
    input.currentScriptId = "b";
    const selected = projectWorkspace(input, first.signature);
    assert.ok(
      files(selected).some(
        (file) => file.uri === "file:///userscripts/b/types.d.ts"
      )
    );
    assert.ok(
      !files(selected).some(
        (file) => file.uri === "file:///userscripts/a/styles.scss"
      )
    );
    input.drafts.a = draftFromScript(a);
    input.drafts.a.typeDefinitions = "export type X = number;";
    input.drafts.a.revision++;
    const exported = projectWorkspace(input, selected.signature);
    assert.ok(
      files(exported).some(
        (file) => file.uri === "file:///userscripts/a/types.d.ts"
      )
    );
    input.drafts.a.scss = ".edited {}";
    input.drafts.a.dirty.scss = true;
    input.drafts.a.revision++;
    assert.notEqual(projectWorkspace(input, exported.signature), null);
    delete input.scripts.a;
    assert.deepEqual(projectWorkspace(input).modulePaths, ["b"]);
  });

  it("keeps main models with no selection while excluding ambient types and clean styles", () => {
    const script = buildUserscriptFixture();
    const plan = projectWorkspace(
      projectionInput([script], { currentScriptId: "missing" })
    );
    assert.deepEqual(
      plan.models.map((model) => model.editor),
      ["main"]
    );
    assert.deepEqual(plan.cdnModules, []);
    assert.deepEqual(projectWorkspace(projectionInput([])).models, []);
  });
});

describe("workspace invalidation", () => {
  it("includes SCSS and CDN associations even when timestamps are unchanged", () => {
    const script = buildUserscriptFixture();
    const input = projectionInput([script], {
      modules: { m: buildModuleFixture({ id: "m" }) },
    });
    const initial = projectWorkspace(input);
    script.code.source.scss = ".changed {}";
    const styles = projectWorkspace(input, initial.signature);
    assert.ok(styles);
    assert.equal(
      styles.models.find((model) => model.editor === "styles").contents,
      ".changed {}"
    );
    script.globalModules = ["m"];
    const cdn = projectWorkspace(input, styles.signature);
    assert.deepEqual(
      cdn.cdnModules.map((module) => module.id),
      ["m"]
    );
  });
  it("ignores metadata that changes no desired model or CDN type", () => {
    const script = buildUserscriptFixture();
    const input = projectionInput([script]);
    const initial = projectWorkspace(input);
    script.name = "Renamed";
    script.updatedAt++;
    script.code.compiled.css = ".saved {}";
    assert.equal(projectWorkspace(input, initial.signature), null);
  });
});
