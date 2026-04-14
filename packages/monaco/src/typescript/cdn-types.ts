/**
 * Fetches TypeScript type definitions for CDN modules from DefinitelyTyped.
 * Results are cached in memory to avoid redundant network requests.
 */

const typeCache = new Map<string, string | null>();

/**
 * Fetches the `index.d.ts` for a given npm package from DefinitelyTyped.
 * Tries unpkg first, falls back to jsdelivr. Returns `null` if no types are
 * found or if the fetch fails.
 */
export async function fetchModuleTypes(
  packageName: string
): Promise<string | null> {
  if (typeCache.has(packageName)) {
    return typeCache.get(packageName) ?? null;
  }

  const urls = [
    `https://unpkg.com/@types/${packageName}/index.d.ts`,
    `https://cdn.jsdelivr.net/npm/@types/${packageName}/index.d.ts`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        const text = await response.text();
        typeCache.set(packageName, text);
        return text;
      }
    } catch {
      // Fall through to next URL
    }
  }

  typeCache.set(packageName, null);
  return null;
}
