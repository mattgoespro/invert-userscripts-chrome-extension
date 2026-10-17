import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
function harness(resolveTypePackage) {
  const cache = new Map(),
    libs = new Map(),
    disposed = [];
  const request = (value) => {
    const result = { result: value };
    queueMicrotask(() => result.onsuccess?.());
    return result;
  };
  const database = {
    transaction: () => ({
      objectStore: () => ({
        get: (key) => request(cache.get(key)),
        put: (value) => {
          cache.set(value.packageName, value);
          return request(value);
        },
      }),
    }),
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL(
          "../packages/monaco/src/typescript/cdn-types.ts",
          import.meta.url
        ),
        "utf8"
      ),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }
    ).outputText,
    {
      exports,
      console,
      Date,
      TextEncoder,
      AbortController,
      AbortSignal,
      indexedDB: { open: () => request(database) },
      require: (name) =>
        name === "./type-package-resolver"
          ? { resolveTypePackage }
          : {
              addTypeLib: (contents, uri) => {
                libs.set(uri, contents);
                return {
                  dispose: () => {
                    libs.delete(uri);
                    disposed.push(uri);
                  },
                };
              },
            },
    }
  );
  return { ...exports, cache, libs, disposed };
}
const result = (input, dependencies = {}) => ({
  packageName: input.packageName,
  version: input.version,
  entry: "index.d.ts",
  files: { "index.d.ts": "export type Version = '" + input.version + "';" },
  dependencies,
});
test("acquisition deduplicates requests and uses a warm versioned cache while offline", async () => {
  let calls = 0,
    offline = false;
  const h = harness(async (input) => {
    calls++;
    if (offline) {
      throw new Error("offline");
    }
    return result(input);
  });
  await Promise.all([
    h.acquirePackageTypes("sample", "1"),
    h.acquirePackageTypes("sample", "1"),
  ]);
  assert.equal(calls, 1);
  offline = true;
  assert.ok((await h.acquirePackageTypes("sample", "1")).has("sample"));
  assert.equal(calls, 1);
  await assert.rejects(() => h.acquirePackageTypes("sample", "2"), /offline/);
});
test("temporary transport errors are retried and incompatible transitive ranges are visible failures", async () => {
  let calls = 0;
  const h = harness(async (input) => {
    if (++calls === 1) {
      throw new Error("503");
    }
    return result(
      input,
      input.packageName === "root"
        ? { a: "1", b: "2" }
        : input.packageName === "b"
          ? { a: "2" }
          : {}
    );
  });
  await assert.rejects(() => h.acquirePackageTypes("root", "1"), /503/);
  await assert.rejects(
    () => h.acquirePackageTypes("root", "1"),
    /Incompatible/
  );
});
test("duplicate modules share declaration ownership until the last reference is removed", async () => {
  const h = harness(async (input) => result(input));
  await h.syncCdnModuleLibs([
    { id: "one", packageName: "sample", typeVersion: "1" },
    { id: "two", packageName: "sample", typeVersion: "1" },
  ]);
  assert.equal(h.libs.size, 2);
  await h.syncCdnModuleLibs([
    { id: "two", packageName: "sample", typeVersion: "1" },
  ]);
  assert.equal(h.libs.size, 2);
  assert.equal(h.disposed.length, 0);
  await h.syncCdnModuleLibs([]);
  assert.equal(h.libs.size, 0);
});
test("a stale acquisition finishing after a newer version cannot replace its declarations", async () => {
  let finish;
  const h = harness((input) =>
    input.version === "1"
      ? new Promise((resolve) => {
          finish = () => resolve(result(input));
        })
      : Promise.resolve(result(input))
  );
  const old = h.syncCdnModuleLibs([
    { id: "one", packageName: "sample", typeVersion: "1" },
  ]);
  while (!finish) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await h.syncCdnModuleLibs([
    { id: "one", packageName: "sample", typeVersion: "2" },
  ]);
  finish();
  await old;
  assert.ok([...h.libs.values()].some((contents) => contents.includes("'2'")));
  assert.ok(![...h.libs.values()].some((contents) => contents.includes("'1'")));
});
