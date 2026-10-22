import assert from "node:assert/strict";
import test from "node:test";
import {
  isEditorSettings,
  isPublicationCommand,
  isTrustedExtensionSender,
} from "../packages/shared/src/publication/protocol.ts";

test("Error Lens settings accept booleans and existing settings, rejecting invalid values", () => {
  assert.equal(isEditorSettings({}), true);
  assert.equal(isEditorSettings({ errorLens: true }), true);
  assert.equal(isEditorSettings({ errorLens: false }), true);
  for (const errorLens of ["false", 0, null]) {
    assert.equal(isEditorSettings({ errorLens }), false);
  }
});
test("mutation protocol rejects malformed changes and page callers despite claimed sources", () => {
  assert.equal(
    isPublicationCommand({
      requestId: "x",
      writes: [{ id: "a", expectedRevision: null, script: {} }],
    }),
    false
  );
  assert.equal(
    isPublicationCommand({
      requestId: "x",
      writes: [{ id: "a", expectedRevision: null, deleted: true }],
    }),
    true
  );
  assert.equal(
    isTrustedExtensionSender(
      { id: "ext", url: "https://example.com", tab: { id: 1 } },
      "ext"
    ),
    false
  );
  assert.equal(
    isTrustedExtensionSender(
      { id: "ext", url: "chrome-extension://ext/options.html" },
      "ext"
    ),
    true
  );
  assert.equal(
    isTrustedExtensionSender(
      { id: "other", url: "chrome-extension://ext/options.html" },
      "ext"
    ),
    false
  );
  assert.equal(
    isPublicationCommand({
      requestId: "x",
      writes: [],
      modules: { expectedRevision: null, value: { a: { id: "a", url: 8 } } },
    }),
    false
  );
  assert.equal(
    isPublicationCommand({
      requestId: "x",
      writes: [],
      settings: { expectedRevision: null, value: { fontSize: -5 } },
    }),
    false
  );
});
