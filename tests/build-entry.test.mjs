import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("the build entry loads a TypeScript Webpack config without shell loader setup", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "invert-webpack-entry-"));
  try {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ type: "module" })
    );
    symlinkSync(
      fileURLToPath(new URL("../node_modules", import.meta.url)),
      path.join(root, "node_modules"),
      "junction"
    );
    const config = path.join(root, "webpack.config.ts");
    writeFileSync(
      config,
      'const mode: "production" = "production"; export default { mode };'
    );
    const env = { ...process.env };
    delete env.NODE_OPTIONS;
    env.TS_NODE_PROJECT = path.join(root, "nonexistent-config.json");
    const output = execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL("../scripts/webpack.mjs", import.meta.url)),
        "configtest",
        config,
      ],
      { cwd: root, env, encoding: "utf8", timeout: 30_000, stdio: "pipe" }
    );
    assert.match(output, /no validation errors|successfully validated/i);
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});
