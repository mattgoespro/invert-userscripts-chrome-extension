import fs from "fs-extra";
import path from "node:path";

const ServiceWorkerClientScriptPath = path.join(import.meta.dirname, "client.js");

export function parseClientFileContents(variables: string[][]): string {
  let script = fs.readFileSync(ServiceWorkerClientScriptPath, "utf-8");

  for (const [variable, value] of variables) {
    script = script.replace(`{{${variable}}}`, value);
  }

  return script;
}
