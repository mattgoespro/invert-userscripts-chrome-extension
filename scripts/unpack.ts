import fs from "fs-extra";
import path from "path";
import os from "os";
import packageJson from "../package.json";
import tsconfig from "../tsconfig.json" with { type: "json" };

const destinationDir = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "Google",
  "Chrome",
  "Unpacked Extensions",
  `${packageJson.name}-${packageJson.version}-unpacked`
);

fs.ensureDirSync(destinationDir);

const extensionDir = path.resolve(tsconfig.compilerOptions.outDir);

console.log(`Copying unpacked extension -> ${destinationDir}`);

try {
  fs.copySync(extensionDir, destinationDir);
  console.log("Extension copied successfully.");
} catch (error) {
  console.error("Error copying extension:", error);
  process.exitCode = 1;
}
