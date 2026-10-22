import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, createPublicKey } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8")
);

const requiredFiles = [
  "manifest.json",
  "background.js",
  "popup.js",
  "popup.html",
  "options.js",
  "options.html",
  "build-worker.js",
  "sass-sandbox.js",
  "sass-sandbox.html",
];

/** Soft budgets for lean surfaces (options/Monaco intentionally larger). */
const sizeBudgets = {
  // Transactional publication + persistent Drive transport: docs/architecture/drive-sync.md.
  "background.js": 80 * 1024,
  "popup.js": 400 * 1024,
};

function fail(message) {
  console.error(`check-manifest: ${message}`);
  process.exitCode = 1;
}

if (!existsSync(dist)) {
  fail(`dist/ missing — run pnpm build first`);
  process.exit(1);
}

for (const file of requiredFiles) {
  const filePath = path.join(dist, file);
  if (!existsSync(filePath)) {
    fail(`missing build output: ${file}`);
  }
}

const manifestPath = path.join(dist, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const driveConfiguration = JSON.parse(
  readFileSync(path.join(root, "config/google-drive.json"), "utf8")
);
assert.equal(
  manifest.key,
  driveConfiguration.publicKey.trim(),
  "Built extension must retain the repository's shared public key"
);
const publicKey = createPublicKey({
  key: Buffer.from(manifest.key, "base64"),
  format: "der",
  type: "spki",
});
const extensionId = createHash("sha256")
  .update(publicKey.export({ type: "spki", format: "der" }))
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (digit) =>
    String.fromCharCode(97 + parseInt(digit, 16))
  );
assert.equal(extensionId, driveConfiguration.extensionId);
assert.equal(
  manifest.oauth2?.client_id,
  driveConfiguration.clientId.trim() || undefined,
  "Built OAuth client must match the shared repository configuration"
);

assert.equal(
  manifest.version,
  packageJson.version,
  `manifest.version (${manifest.version}) must match package.json (${packageJson.version})`
);

assert.equal(manifest.background?.service_worker, "background.js");
assert.equal(manifest.action?.default_popup, "popup.html");
assert.equal(manifest.options_ui?.page, "options.html");
assert.ok(
  manifest.permissions.includes("identity"),
  "Drive authorization requires identity permission"
);
if (manifest.oauth2) {
  assert.ok(
    manifest.key,
    "Drive OAuth builds require Invert's stable public key"
  );
  assert.deepEqual(manifest.oauth2.scopes, [
    "https://www.googleapis.com/auth/drive.appdata",
  ]);
}
console.log(
  `ok  stable extension ID ${extensionId}; Drive OAuth ${manifest.oauth2 ? "configured" : "awaiting clientId"}`
);

for (const [file, budget] of Object.entries(sizeBudgets)) {
  const size = statSync(path.join(dist, file)).size;
  if (size > budget) {
    fail(
      `${file} is ${size} bytes (budget ${budget}). Investigate popup/background regressions.`
    );
  } else {
    console.log(`ok  ${file}: ${size} bytes (budget ${budget})`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(
  `ok  manifest version ${manifest.version} matches package.json; required assets present`
);
