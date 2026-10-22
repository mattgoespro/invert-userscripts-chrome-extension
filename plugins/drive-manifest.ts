import { createHash, createPublicKey } from "node:crypto";
import sharedConfiguration from "../config/google-drive.json" with { type: "json" };

export interface DriveBuildConfiguration {
  extensionId: string;
  publicKey: string;
  clientId: string;
}

/** Public build configuration only; OAuth client secrets must never enter a bundle. */
export function configureDriveManifest(
  manifest: chrome.runtime.ManifestV3,
  configuration: DriveBuildConfiguration = sharedConfiguration
): chrome.runtime.ManifestV3 {
  const publicKey = configuration.publicKey?.trim();
  if (!publicKey) {
    throw new Error(
      "config/google-drive.json must contain Invert's public key to keep the extension ID stable."
    );
  }
  let keyBytes: Buffer;
  try {
    const key = createPublicKey({
      key: Buffer.from(publicKey, "base64"),
      format: "der",
      type: "spki",
    });
    keyBytes = key.export({ format: "der", type: "spki" });
    if (keyBytes.toString("base64") !== publicKey) {
      throw new Error("Noncanonical public key.");
    }
  } catch {
    throw new Error(
      "config/google-drive.json must contain a valid base64-encoded SPKI public key."
    );
  }
  const extensionId = createHash("sha256")
    .update(keyBytes)
    .digest("hex")
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (digit) =>
      String.fromCharCode(97 + parseInt(digit, 16))
    );
  if (extensionId !== configuration.extensionId) {
    throw new Error(
      `The public key does not match the expected extension ID in config/google-drive.json (derived ${extensionId}).`
    );
  }
  if (
    typeof configuration.clientId !== "string" ||
    (configuration.clientId.trim() &&
      !/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(
        configuration.clientId.trim()
      ))
  ) {
    throw new Error(
      "Set clientId in config/google-drive.json to a Chrome Extension OAuth client ID, or leave it empty until registered."
    );
  }
  const clientId = configuration.clientId.trim();
  const result = { ...manifest, key: publicKey };
  delete result.oauth2;
  if (!clientId) {
    return result;
  }
  return {
    ...result,
    oauth2: {
      client_id: clientId,
      scopes: ["https://www.googleapis.com/auth/drive.appdata"],
    },
  };
}
