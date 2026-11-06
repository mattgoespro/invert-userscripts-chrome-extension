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
test("one failing module registers the others and still reports the failure", async () => {
  const h = harness(async (input) => {
    if (input.packageName === "bad") {
      throw new Error("bad package");
    }
    return result(input);
  });
  await assert.rejects(
    () =>
      h.syncCdnModuleLibs([
        { id: "bad", packageName: "bad", typeVersion: "1" },
        { id: "good", packageName: "good", typeVersion: "1" },
      ]),
    /bad package/
  );
  assert.ok(
    h.libs.has("file:///node_modules/@types/good/index.d.ts"),
    "the healthy module is registered"
  );
  assert.ok(!h.libs.has("file:///node_modules/@types/bad/index.d.ts"));
});
test("every distinct failure is reported", async () => {
  const h = harness(async (input) => {
    throw new Error(input.packageName + " failed");
  });
  await assert.rejects(
    () =>
      h.syncCdnModuleLibs([
        { id: "a", packageName: "a", typeVersion: "1" },
        { id: "b", packageName: "b", typeVersion: "1" },
      ]),
    (error) =>
      error.message.includes("a failed") && error.message.includes("b failed")
  );
});
test("a failed refresh keeps existing declarations until acquisition completes", async () => {
  let offline = false;
  const h = harness(async (input) => {
    if (offline && input.version === "2") {
      throw new Error("offline");
    }
    return result(input);
  });
  await h.syncCdnModuleLibs([
    { id: "m", packageName: "sample", typeVersion: "1" },
  ]);
  offline = true;
  await assert.rejects(
    () =>
      h.syncCdnModuleLibs([
        { id: "m", packageName: "sample", typeVersion: "2" },
      ]),
    /offline/
  );
  assert.equal(h.libs.size, 2);
  assert.equal(h.disposed.length, 0);
  offline = false;
  await h.syncCdnModuleLibs([
    { id: "m", packageName: "sample", typeVersion: "2" },
  ]);
  assert.ok([...h.libs.values()].some((contents) => contents.includes("'2'")));
  await h.syncCdnModuleLibs([]);
  assert.equal(h.libs.size, 0);
});
test("a stale failure does not surface after a newer sync", async () => {
  let fail;
  const h = harness((input) =>
    input.version === "1"
      ? new Promise((_resolve, reject) => {
          fail = () => reject(new Error("stale"));
        })
      : Promise.resolve(result(input))
  );
  const old = h.syncCdnModuleLibs([
    { id: "m", packageName: "sample", typeVersion: "1" },
  ]);
  while (!fail) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  await h.syncCdnModuleLibs([
    { id: "m", packageName: "sample", typeVersion: "2" },
  ]);
  fail();
  await old;
  assert.ok([...h.libs.values()].some((contents) => contents.includes("'2'")));
});
