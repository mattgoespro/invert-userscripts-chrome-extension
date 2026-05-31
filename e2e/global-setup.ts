import fs from "fs";
import path from "path";

export default function globalSetup() {
  const manifestPath = path.resolve(
    import.meta.dirname,
    "../dist/manifest.json"
  );

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      "[e2e] dist/manifest.json not found.\nRun `npm run build` before running the e2e suite."
    );
  }
}
