import type * as monaco from "monaco-editor";
import { addTypeLib } from "./defaults";
import { resolveTypePackage } from "./type-package-resolver";

/**
 * Dependency-aware automatic type acquisition (ATA) for CDN global modules.
 *
 * For each module with a `packageName`, the resolver fetches the package's
 * DefinitelyTyped entry point and then walks its dependency graph:
 * triple-slash `path` references and relative import/export specifiers pull in
 * sibling `.d.ts` files; triple-slash `types` references pull in transitive
 * `@types` packages. Every fetched file is registered with the TypeScript
 * language service at its real `node_modules/@types/...` path so multi-file
 * type packages resolve exactly as they would in a Node project.
 *
 * Results persist in IndexedDB so subsequent sessions skip the network
 * entirely, and registration is non-blocking — editors never wait on it.
 */

type PackageFiles = Record<string, string>;

const MAX_TRANSITIVE_PACKAGES = 10;

// ── IndexedDB cache ───────────────────────────────────────────────────────────

const DB_NAME = "invert-ide-type-cache";
const DB_STORE = "packages";
const DB_VERSION = 1;

interface CachedPackage {
  packageName: string;
  fetchedAt: number;
  /** null marks a confirmed "no types available" so we don't refetch. */
  files: PackageFiles | null;
  resolvedVersion?: string;
  dependencies?: Record<string, string>;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function openTypeCacheDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "packageName" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

let dbPromise: Promise<IDBDatabase | null> | undefined;

function getDb(): Promise<IDBDatabase | null> {
  dbPromise ??= openTypeCacheDb();
  return dbPromise;
}

async function readCachedPackage(
  packageName: string
): Promise<CachedPackage | null> {
  const db = await getDb();

  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    const request = db
      .transaction(DB_STORE, "readonly")
      .objectStore(DB_STORE)
      .get(packageName);

    request.onsuccess = () => {
      const entry = request.result as CachedPackage | undefined;

      if (!entry || Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
        resolve(null);
        return;
      }

      resolve(entry);
    };
    request.onerror = () => resolve(null);
  });
}

async function writeCachedPackage(entry: CachedPackage): Promise<void> {
  const db = await getDb();

  if (!db) {
    return;
  }

  await new Promise<void>((resolve) => {
    const request = db
      .transaction(DB_STORE, "readwrite")
      .objectStore(DB_STORE)
      .put(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

// Versioned acquisition with shared requests, cancellation, and explicit limits.
const inFlight = new Map<string, Promise<CachedPackage>>();
const cancellableFlights = new WeakMap<
  AbortSignal,
  Map<string, Promise<CachedPackage>>
>();
async function acquireCachedPackage(
  packageName: string,
  version: string,
  signal?: AbortSignal
): Promise<CachedPackage> {
  const key = "resolver-v2:" + packageName + "@" + version;
  const cached = await readCachedPackage(key);
  if (cached) {
    return cached;
  }
  if (signal && !cancellableFlights.has(signal)) {
    cancellableFlights.set(signal, new Map());
  }
  const flights = signal ? cancellableFlights.get(signal)! : inFlight;
  if (flights.has(key)) {
    return flights.get(key)!;
  }
  const pending = (async () => {
    const result = await resolveTypePackage({ packageName, version, signal });
    const entry: CachedPackage = {
      packageName: key,
      fetchedAt: Date.now(),
      files: result
        ? {
            ...result.files,
            "package.json": JSON.stringify({
              name: "@types/" + packageName,
              types: result.entry,
            }),
          }
        : null,
      resolvedVersion: result?.version,
      dependencies: result?.dependencies,
    };
    await writeCachedPackage(entry);
    return entry;
  })().finally(() => {
    if (flights.get(key) === pending) {
      flights.delete(key);
    }
  });
  flights.set(key, pending);
  return pending;
}
export async function acquirePackageTypes(
  rootPackageName: string,
  version = "latest",
  signal?: AbortSignal
): Promise<Map<string, PackageFiles>> {
  const resolved = new Map<string, PackageFiles>();
  const queue = [{ packageName: rootPackageName, version }];
  const visited = new Map<string, string>();
  let totalBytes = 0;
  while (queue.length) {
    signal?.throwIfAborted();
    const next = queue.shift()!;
    if (visited.has(next.packageName)) {
      const previous = visited.get(next.packageName);
      if (
        previous !== next.version &&
        previous !== "*" &&
        next.version !== "*"
      ) {
        throw new Error(
          "Incompatible declaration requirements for " +
            next.packageName +
            ": " +
            previous +
            " and " +
            next.version
        );
      }
      continue;
    }
    if (visited.size >= MAX_TRANSITIVE_PACKAGES) {
      throw new Error("Declaration package limit exceeded.");
    }
    visited.set(next.packageName, next.version);
    const cached = await acquireCachedPackage(
      next.packageName,
      next.version,
      signal
    );
    if (!cached.files) {
      continue;
    }
    totalBytes += Object.values(cached.files).reduce(
      (sum, text) => sum + new TextEncoder().encode(text).length,
      0
    );
    if (totalBytes > 5 * 1024 * 1024) {
      throw new Error("Declaration byte limit exceeded.");
    }
    resolved.set(next.packageName, cached.files);
    for (const [packageName, range] of Object.entries(
      cached.dependencies ?? {}
    )) {
      queue.push({ packageName, version: range });
    }
  }
  return resolved;
}

// ── Language-service registration ─────────────────────────────────────────────

export interface CdnModuleInfo {
  id: string;
  packageName: string;
  typeVersion?: string;
}

let syncGeneration = 0;
let acquisitionController: AbortController | undefined;

/**
 * Syncs CDN module type registrations with the provided list. Callers should
 * pass every configured CDN module (eager global set), not only those attached
 * to the active script — otherwise switching scripts disposes libs and causes
 * brief "cannot find module" diagnostics.
 *
 * Fetching and registration are asynchronous and incremental: each package's
 * files are registered as soon as they resolve. Disposes registrations for
 * modules no longer in the list (e.g. deleted from storage).
 */
const registeredFiles = new Map<
  string,
  { contents: string; disposable: monaco.IDisposable }
>();
export async function syncCdnModuleLibs(
  modules: CdnModuleInfo[]
): Promise<void> {
  const generation = ++syncGeneration;
  acquisitionController?.abort();
  const controller = new AbortController();
  acquisitionController = controller;
  const packages = await Promise.all(
    modules
      .filter((module) => module.packageName)
      .map((module) =>
        acquirePackageTypes(
          module.packageName,
          module.typeVersion,
          controller.signal
        )
      )
  );
  if (generation !== syncGeneration) {
    return;
  }
  const desired = new Map<string, string>();
  for (const packageSet of packages) {
    for (const [packageName, files] of packageSet) {
      const path = packageName.startsWith("@")
        ? packageName.slice(1).replace("/", "__")
        : packageName;
      for (const [file, contents] of Object.entries(files)) {
        const uri = `file:///node_modules/@types/${path}/${file}`;
        if (desired.has(uri) && desired.get(uri) !== contents) {
          throw new Error(
            "Configured modules require incompatible declarations for " +
              packageName
          );
        }
        desired.set(uri, contents);
      }
    }
  }
  // Single ownership avoids one module disposing another module's shared declarations.
  for (const [uri, entry] of registeredFiles) {
    if (desired.get(uri) !== entry.contents) {
      entry.disposable.dispose();
      registeredFiles.delete(uri);
    }
  }
  for (const [uri, contents] of desired) {
    if (!registeredFiles.has(uri)) {
      registeredFiles.set(uri, {
        contents,
        disposable: addTypeLib(contents, uri),
      });
    }
  }
}
