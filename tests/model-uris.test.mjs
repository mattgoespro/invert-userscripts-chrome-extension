import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModelUri,
  buildScriptFileUri,
  buildScriptModelId,
} from "../packages/monaco/src/typescript/model-uris.ts";

test("buildScriptModelId uses stable script identity for main and styles", () => {
  assert.equal(
    buildScriptModelId({ id: "script-1", moduleName: "Dom Utils" }, "main"),
    "userscripts/script-1/main"
  );
  assert.equal(
    buildScriptModelId({ id: "script-1", moduleName: "Dom Utils" }, "styles"),
    "userscripts/script-1/styles"
  );
});

test("buildScriptModelId uses types.d suffix for declaration buffers", () => {
  assert.equal(
    buildScriptModelId({ id: "script-1", moduleName: "helpers" }, "types"),
    "userscripts/script-1/types.d"
  );
});

test("buildScriptModelId falls back to script id when moduleName sanitizes empty", () => {
  assert.equal(
    buildScriptModelId({ id: "script-42", moduleName: "@@@" }, "main"),
    "userscripts/script-42/main"
  );
  assert.equal(
    buildScriptModelId({ id: "script-42" }, "types"),
    "userscripts/script-42/types.d"
  );
});

test("buildModelUri appends language-specific extensions", () => {
  assert.equal(
    buildModelUri("scripts/helpers/main", "typescript"),
    "file:///scripts/helpers/main.ts"
  );
  assert.equal(
    buildModelUri("scripts/helpers/styles", "scss"),
    "file:///scripts/helpers/styles.scss"
  );
});

test("buildScriptFileUri builds canonical Monaco URIs per editor kind", () => {
  const script = { id: "script-1", moduleName: "shared-lib" };

  assert.equal(
    buildScriptFileUri(script, "main"),
    "file:///userscripts/script-1/main.ts"
  );
  assert.equal(
    buildScriptFileUri(script, "types"),
    "file:///userscripts/script-1/types.d.ts"
  );
  assert.equal(
    buildScriptFileUri(script, "styles"),
    "file:///userscripts/script-1/styles.scss"
  );
});

test("alias changes leave editing model identity and undo history attached", () => {
  assert.equal(
    buildScriptFileUri({ id: "a", moduleName: "before" }, "main"),
    buildScriptFileUri({ id: "a", moduleName: "after" }, "main")
  );
});
