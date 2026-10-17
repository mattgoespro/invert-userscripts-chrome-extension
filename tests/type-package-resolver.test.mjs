import assert from "node:assert/strict";
import test from "node:test";
import { resolveTypePackage } from "../packages/monaco/src/typescript/type-package-resolver.ts";
test("bundled declarations retain scoped and ordinary transitive dependency ranges", async () => {
  const result = await resolveTypePackage(
    { packageName: "sample" },
    async (url) =>
      new Response(
        url.endsWith("package.json")
          ? JSON.stringify({
              version: "1.2.3",
              types: "index.d.ts",
              dependencies: { dependency: "^1.0.0", "@scope/lib": "~2.0.0" },
            })
          : 'import { X } from "dependency/subpath";\nimport { Y } from "@scope/lib/types";'
      )
  );
  assert.deepEqual(result.dependencies, {
    dependency: "^1.0.0",
    "@scope/lib": "~2.0.0",
  });
});
test("package metadata selects an exact declaration entry and follows sibling references", async () => {
  const files = {
    "package.json": JSON.stringify({
      version: "1.2.3",
      types: "types/root.d.ts",
    }),
    "types/root.d.ts": 'export { X } from "./other";',
    "types/other.d.ts": "export interface X { value: number }",
  };
  const result = await resolveTypePackage(
    { packageName: "sample", version: "1.2.3" },
    async (url) => {
      const path = url.split("/sample@1.2.3/")[1];
      return new Response(files[path] ?? "", {
        status: files[path] ? 200 : 404,
      });
    }
  );
  assert.equal(result.version, "1.2.3");
  assert.equal(result.entry, "types/root.d.ts");
  assert.equal(
    result.files["types/other.d.ts"],
    "export interface X { value: number }"
  );
});
test("temporary failures are errors and cannot be cached as missing types", async () => {
  await assert.rejects(
    () =>
      resolveTypePackage(
        { packageName: "sample", version: "1.2.3" },
        async () => new Response("", { status: 503 })
      ),
    /503/
  );
});
test("acquisition rejects excess bytes instead of returning a silently truncated graph", async () => {
  await assert.rejects(
    () =>
      resolveTypePackage(
        { packageName: "large", version: "1" },
        async (url) =>
          new Response(
            url.endsWith("package.json")
              ? JSON.stringify({ version: "1", types: "index.d.ts" })
              : "x".repeat(5 * 1024 * 1024 + 1)
          )
      ),
    /limit/
  );
});
