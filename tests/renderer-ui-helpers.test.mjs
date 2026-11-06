import assert from "node:assert/strict";
import test from "node:test";
import { isBackdropPointer } from "../packages/renderer/src/shared/components/dialog/backdrop.ts";
import { buildNameUpdates } from "../packages/renderer/src/options/invert-ide/pages/scripts-page/script-editor/script-metadata/name-updates.ts";
import { getFocusWrapTarget } from "../packages/renderer/src/options/invert-ide/pages/scripts-page/script-editor/script-details/focus-trap.ts";
import { readBuildOutput } from "../packages/renderer/src/options/invert-ide/pages/scripts-page/script-editor/live-output-result.ts";
import { parseNumberSetting } from "../packages/renderer/src/options/invert-ide/pages/settings-page/number-setting.ts";
import {
  consumeSettingsSectionRequest,
  requestSettingsSection,
  subscribeToSettingsSectionRequests,
} from "../packages/renderer/src/options/invert-ide/pages/settings-page/settings-navigation.ts";
import { PrettierFormatter } from "../packages/renderer/src/sandbox/formatter.ts";

test("a press inside the dialog is not a backdrop press", () => {
  const dialog = {
    getBoundingClientRect: () => ({
      left: 100,
      right: 300,
      top: 100,
      bottom: 300,
    }),
  };
  const at = (target, clientX, clientY) => ({
    target,
    currentTarget: dialog,
    clientX,
    clientY,
  });
  assert.equal(isBackdropPointer(at(dialog, 50, 50)), true);
  assert.equal(isBackdropPointer(at(dialog, 200, 200)), false);
  assert.equal(isBackdropPointer(at({}, 200, 200)), false);
});

test("retyping a cleared name doesn't share a script that never was", () => {
  assert.deepEqual(buildNameUpdates({ name: "", moduleName: "" }, "a"), {
    name: "a",
  });
  assert.deepEqual(buildNameUpdates({ name: "Old", moduleName: "" }, "a"), {
    name: "a",
  });
});

test("a module name that mirrors the script name follows renames", () => {
  assert.deepEqual(
    buildNameUpdates({ name: "Foo", moduleName: "foo" }, "Bar"),
    { name: "Bar", moduleName: "bar", shared: true }
  );
  assert.deepEqual(buildNameUpdates({ name: "Foo", moduleName: "foo" }, ""), {
    name: "",
    moduleName: "",
    shared: false,
  });
  assert.deepEqual(
    buildNameUpdates({ name: "Foo", moduleName: "custom" }, "Bar"),
    { name: "Bar" }
  );
});

test("Tab cycles at the ends of the drawer and leaves the middle alone", () => {
  const items = ["a", "b", "c"];
  assert.equal(getFocusWrapTarget(items, "c", false), "a");
  assert.equal(getFocusWrapTarget(items, "a", true), "c");
  assert.equal(getFocusWrapTarget(items, "b", false), null);
  assert.equal(getFocusWrapTarget(items, "b", true), null);
  assert.equal(getFocusWrapTarget(items, "drawer", false), "a");
  assert.equal(getFocusWrapTarget(items, "drawer", true), "c");
  assert.equal(getFocusWrapTarget([], "drawer", false), null);
});

test("a failed build keeps its error and an empty build has none", () => {
  assert.deepEqual(
    readBuildOutput({ success: false, error: new Error("Unexpected }") }),
    { code: "", error: "Unexpected }" }
  );
  assert.equal(readBuildOutput({ success: false }).code, "");
  assert.ok(readBuildOutput({ success: false }).error);
  assert.deepEqual(readBuildOutput({ success: true, code: "" }), {
    code: "",
    error: null,
  });
  assert.deepEqual(readBuildOutput({ success: true, code: "x" }), {
    code: "x",
    error: null,
  });
});

test("number settings commit only whole values in range", () => {
  assert.equal(parseNumberSetting("14", 8, 32), 14);
  assert.equal(parseNumberSetting("8", 8, 32), 8);
  assert.equal(parseNumberSetting("32", 8, 32), 32);
  for (const text of ["", " ", "1", "33", "12.5", "abc"]) {
    assert.equal(parseNumberSetting(text, 8, 32), null, text);
  }
});

test("a settings section request waits for the page and is taken once", () => {
  requestSettingsSection("advanced");
  assert.equal(consumeSettingsSectionRequest(), "advanced");
  assert.equal(consumeSettingsSectionRequest(), null);

  let notified = 0;
  const unsubscribe = subscribeToSettingsSectionRequests(() => {
    notified += 1;
  });
  requestSettingsSection("build");
  unsubscribe();
  requestSettingsSection("advanced");
  assert.equal(notified, 1);
  assert.equal(consumeSettingsSectionRequest(), "advanced");
});

test("the formatter indents with the requested tab width", async () => {
  const source = "function f() {\nreturn 1;\n}\n";
  assert.match(
    await PrettierFormatter.format(source, "typescript"),
    /^ {2}return/m
  );
  assert.match(
    await PrettierFormatter.format(source, "typescript", 4),
    /^ {4}return/m
  );
});
