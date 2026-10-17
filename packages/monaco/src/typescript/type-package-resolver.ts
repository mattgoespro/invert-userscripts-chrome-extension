import { extractFileDependencies } from "./cdn-type-deps";
export interface TypePackageInput {
  packageName: string;
  version?: string;
  signal?: AbortSignal;
}
export interface ResolvedTypePackage {
  packageName: string;
  version: string;
  entry: string;
  files: Record<string, string>;
  dependencies: Record<string, string>;
}
const bases = ["https://unpkg.com/", "https://cdn.jsdelivr.net/npm/"];
type Fetcher = (url: string, options?: RequestInit) => Promise<Response>;
function entryPath(metadata: Record<string, unknown>): string {
  if (metadata.typesVersions) {
    throw new Error("Unsupported typesVersions declaration rule.");
  }
  const exports = metadata.exports as Record<string, unknown> | undefined;
  const root = (exports?.["."] ?? exports) as
    | Record<string, unknown>
    | string
    | undefined;
  const explicit = typeof root === "object" ? root?.types : undefined;
  const path = explicit ?? metadata.types ?? metadata.typings ?? "index.d.ts";
  if (typeof path !== "string" || path.includes("..") || path.includes("*")) {
    throw new Error("Unsupported declaration entry rule.");
  }
  return path.replace(/^\.\//, "");
}
export async function resolveTypePackage(
  input: TypePackageInput,
  fetcher: Fetcher = fetch
): Promise<ResolvedTypePackage | null> {
  if (
    !/^(?:@[\w.-]+\/)?[\w.-]+$/.test(input.packageName) ||
    /[/\\?#]/.test(input.version ?? "")
  ) {
    throw new Error("Invalid type package or version.");
  }
  let bytes = 0;
  const request = async (
    packagePath: string,
    path: string
  ): Promise<string | null> => {
    let lastError: Error | undefined;
    let missing = 0;
    for (const base of bases) {
      input.signal?.throwIfAborted();
      try {
        const response = await fetcher(base + packagePath + "/" + path, {
          signal: input.signal
            ? AbortSignal.any([input.signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        });
        if (response.status === 404) {
          missing++;
          continue;
        }
        if (!response.ok) {
          throw new Error("Type package request failed: " + response.status);
        }
        if (Number(response.headers.get("content-length")) > 5 * 1024 * 1024) {
          throw new Error("Declaration byte limit exceeded.");
        }
        const contents = await response.text();
        bytes += new TextEncoder().encode(contents).length;
        if (bytes > 5 * 1024 * 1024) {
          throw new Error("Declaration byte limit exceeded.");
        }
        return contents;
      } catch (error) {
        input.signal?.throwIfAborted();
        lastError = error instanceof Error ? error : new Error(String(error));
        if (lastError.message.includes("limit")) {
          throw lastError;
        }
      }
    }
    if (missing === bases.length) {
      return null;
    }
    throw lastError ?? new Error("Type acquisition failed.");
  };
  const version = input.version ?? "latest";
  const definitelyTyped = input.packageName.startsWith("@")
    ? input.packageName.slice(1).replace("/", "__")
    : input.packageName;
  const candidates = ["@types/" + definitelyTyped, input.packageName];
  for (const name of candidates) {
    const json = await request(name + "@" + version, "package.json");
    if (json === null) {
      continue;
    }
    const metadata = JSON.parse(json) as Record<string, unknown>;
    if (typeof metadata.version !== "string") {
      throw new Error("Declaration metadata has no exact version.");
    }
    if (
      name === input.packageName &&
      !metadata.types &&
      !metadata.typings &&
      !metadata.exports
    ) {
      continue;
    }
    let entry = entryPath(metadata);
    const files: Record<string, string> = {};
    const dependencies: Record<string, string> = {};
    const queue = [entry];
    if (metadata.exports && typeof metadata.exports === "object") {
      for (const [subpath, rule] of Object.entries(metadata.exports)) {
        if (subpath.includes("*")) {
          throw new Error(
            "Unsupported wildcard declaration export: " + subpath
          );
        }
        if (
          subpath.startsWith("./") &&
          rule &&
          typeof rule === "object" &&
          "types" in rule
        ) {
          queue.push(entryPath({ types: rule.types }));
        }
      }
    }
    const checked = new Set<string>();
    while (queue.length) {
      input.signal?.throwIfAborted();
      let path = queue.shift()!;
      if (checked.has(path)) {
        continue;
      }
      checked.add(path);
      if (checked.size > 50) {
        throw new Error("Declaration file limit exceeded.");
      }
      if (path.startsWith("/") || path.includes("..")) {
        throw new Error("Declaration path escapes package.");
      }
      let contents = await request(name + "@" + metadata.version, path);
      if (contents === null && path.endsWith(".d.ts")) {
        const fallback = path.slice(0, -5) + "/index.d.ts";
        contents = await request(name + "@" + metadata.version, fallback);
        if (contents !== null) {
          if (path === entry) {
            entry = fallback;
          }
          path = fallback;
        }
      }
      if (contents === null) {
        throw new Error("Missing declaration file: " + path);
      }
      files[path] = contents;
      const edges = extractFileDependencies(path, contents);
      queue.push(...edges.files);
      for (const dependency of edges.packages) {
        const versions = metadata.dependencies as
          | Record<string, string>
          | undefined;
        const root = dependency.startsWith("@")
          ? dependency.split("/").slice(0, 2).join("/")
          : dependency.split("/")[0];
        const typed = root.startsWith("@")
          ? root.slice(1).replace("/", "__")
          : root;
        dependencies[root] =
          versions?.[root] ?? versions?.["@types/" + typed] ?? "*";
      }
    }
    return {
      packageName: input.packageName,
      version: metadata.version,
      entry,
      files,
      dependencies,
    };
  }
  return null;
}
