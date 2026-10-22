import assert from "node:assert/strict";
import { generateKeyPairSync, createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { configureDriveManifest } from "../plugins/drive-manifest.ts";

const expectedId = "odebcojfkjmpakmhhihdddfaodkohcfp";
const manifest = { manifest_version: 3, name: "Fixture", version: "1" };
const publicKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .publicKey.export({ type: "spki", format: "der" })
  .toString("base64");
function extensionId(key) {
  return createHash("sha256")
    .update(Buffer.from(key, "base64"))
    .digest("hex")
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (digit) => "abcdefghijklmnop"[parseInt(digit, 16)]);
}
const fixture = {
  publicKey,
  extensionId: extensionId(publicKey),
  clientId: "",
};

test("default builds retain the existing stable identity without ignored key files or OAuth environment variables", () => {
  const built = configureDriveManifest(manifest);
  const shared = JSON.parse(
    readFileSync(
      new URL("../config/google-drive.json", import.meta.url),
      "utf8"
    )
  );
  assert.equal(extensionId(built.key), expectedId);
  assert.equal(built.key, shared.publicKey);
  assert.equal(built.oauth2?.client_id, shared.clientId.trim() || undefined);
});

test("a blank client ID keeps the key and removes stale OAuth configuration", () => {
  const built = configureDriveManifest(
    { ...manifest, oauth2: { client_id: "stale", scopes: ["wrong"] } },
    fixture
  );
  assert.equal(built.key, publicKey);
  assert.equal(built.oauth2, undefined);
});

test("filling only the client ID enables Drive without changing identity", () => {
  const built = configureDriveManifest(manifest, {
    ...fixture,
    clientId: "123-fixture.apps.googleusercontent.com",
  });
  assert.equal(built.key, publicKey);
  assert.deepEqual(built.oauth2, {
    client_id: "123-fixture.apps.googleusercontent.com",
    scopes: ["https://www.googleapis.com/auth/drive.appdata"],
  });
});

test("malformed configuration and mismatched extension IDs fail instead of changing identity", () => {
  assert.throws(
    () => configureDriveManifest(manifest, { ...fixture, publicKey: "broken" }),
    /public key/i
  );
  assert.throws(
    () => configureDriveManifest(manifest, { ...fixture, publicKey: "" }),
    /public key/i
  );
  assert.throws(
    () =>
      configureDriveManifest(manifest, {
        ...fixture,
        extensionId: "a".repeat(32),
      }),
    /extension.*ID/i
  );
  assert.throws(
    () =>
      configureDriveManifest(manifest, { ...fixture, extensionId: undefined }),
    /extension.*ID/i
  );
  assert.throws(
    () => configureDriveManifest(manifest, { ...fixture, clientId: "invalid" }),
    /client/i
  );
  assert.throws(
    () => configureDriveManifest(manifest, { ...fixture, clientId: undefined }),
    /client/i
  );
});

test("stale machine environment cannot replace the shared repository identity", () => {
  const previous = {
    clientId: process.env.INVERT_GOOGLE_CLIENT_ID,
    publicKey: process.env.INVERT_EXTENSION_PUBLIC_KEY,
  };
  try {
    process.env.INVERT_GOOGLE_CLIENT_ID = "invalid-stale-client";
    process.env.INVERT_EXTENSION_PUBLIC_KEY = "invalid-stale-key";
    const built = configureDriveManifest(manifest);
    assert.equal(extensionId(built.key), expectedId);
  } finally {
    for (const [name, value] of Object.entries({
      INVERT_GOOGLE_CLIENT_ID: previous.clientId,
      INVERT_EXTENSION_PUBLIC_KEY: previous.publicKey,
    })) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test("a copied build helper needs only the shared public configuration in a different checkout path", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "invert-drive-config-"));
  try {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ type: "module" })
    );
    mkdirSync(path.join(root, "plugins"));
    mkdirSync(path.join(root, "config"));
    copyFileSync(
      new URL("../plugins/drive-manifest.ts", import.meta.url),
      path.join(root, "plugins/drive-manifest.ts")
    );
    copyFileSync(
      new URL("../config/google-drive.json", import.meta.url),
      path.join(root, "config/google-drive.json")
    );
    const copied = await import(
      pathToFileURL(path.join(root, "plugins/drive-manifest.ts")).href
    );
    const built = copied.configureDriveManifest(manifest);
    assert.equal(extensionId(built.key), expectedId);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});
