import { register } from "node:module";
import { fileURLToPath } from "node:url";

// Resolve against this checkout, regardless of the caller's shell configuration.
process.env.TS_NODE_PROJECT = fileURLToPath(
  new URL("../tsconfig.tools.json", import.meta.url)
);
register("ts-node/esm", import.meta.url);
await import("webpack-cli/bin/cli.js");
