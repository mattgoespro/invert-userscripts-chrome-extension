import { expect, type Page } from "@playwright/test";

export type StoredUserscriptSummary = {
  id: string;
  name: string;
  typescript: string;
  typeDefinitions: string;
  enabled: boolean;
};

/**
 * Read userscripts from `chrome.storage.sync`, decoding both utf8 and gzip
 * manifests (the app writes gzip whenever `CompressionStream` exists).
 */
export async function readStoredUserscripts(
  page: Page
): Promise<StoredUserscriptSummary[]> {
  return page.evaluate(async () => {
    const data = await chrome.storage.sync.get(null);
    const summaries: Array<{
      id: string;
      name: string;
      typescript: string;
      typeDefinitions: string;
      enabled: boolean;
    }> = [];

    const decodeManifest = async (
      scriptId: string,
      manifest: {
        encoding?: string;
        mode?: string;
        data?: string;
        chunkCount?: number;
      }
    ) => {
      let encoded = "";

      if (manifest.mode === "chunked") {
        const chunks: string[] = [];

        for (let index = 0; index < (manifest.chunkCount ?? 0); index++) {
          const chunk = data[`userscript:${scriptId}:chunk:${index}`];

          if (typeof chunk !== "string") {
            return null;
          }

          chunks.push(chunk);
        }

        encoded = chunks.join("");
      } else if (typeof manifest.data === "string") {
        encoded = manifest.data;
      } else {
        return null;
      }

      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0)
      );
      let decodedBytes = bytes;

      if (manifest.encoding === "gzip-base64") {
        decodedBytes = new Uint8Array(
          await new Response(
            new Blob([bytes])
              .stream()
              .pipeThrough(new DecompressionStream("gzip"))
          ).arrayBuffer()
        );
      }

      return JSON.parse(new TextDecoder().decode(decodedBytes)) as {
        name?: string;
        enabled?: true;
        typeDefinitions?: string;
        code?: { source?: { typescript?: string } };
      };
    };

    for (const [key, value] of Object.entries(data)) {
      if (!key.startsWith("userscript:") || key.includes(":chunk:")) {
        continue;
      }

      const scriptId = key.slice("userscript:".length);
      const payload = await decodeManifest(
        scriptId,
        value as {
          encoding?: string;
          mode?: string;
          data?: string;
          chunkCount?: number;
        }
      );

      if (!payload) {
        continue;
      }

      summaries.push({
        id: scriptId,
        name: payload.name ?? "",
        typescript: payload.code?.source?.typescript ?? "",
        typeDefinitions: payload.typeDefinitions ?? "",
        enabled: payload.enabled === true,
      });
    }

    return summaries;
  });
}

export async function waitForStoredTypescript(
  page: Page,
  expected: { includes: string; name?: string }
) {
  await expect
    .poll(
      async () => {
        const scripts = await readStoredUserscripts(page);
        const match = expected.name
          ? scripts.find((script) => script.name === expected.name)
          : scripts[0];

        return match?.typescript ?? "";
      },
      { timeout: 15_000 }
    )
    .toContain(expected.includes);
}
