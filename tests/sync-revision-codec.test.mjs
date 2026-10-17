import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeSyncRevision,
  decodeSyncRevision,
} from "../packages/shared/src/storage/sync/revision-codec.ts";
import { mergeSyncRevision } from "../packages/shared/src/storage/sync/replication.ts";
import { buildUserscriptFixture } from "./helpers/fixtures.mjs";
test("later parent metadata repairs an apparent conflict between ancestor and descendant", () => {
  const records = {
    a: { revision: "a", parents: [] },
    c: { revision: "c", parents: ["b"] },
  };
  assert.deepEqual(
    mergeSyncRevision(["a", "c"], { revision: "b", parents: ["a"] }, records),
    { status: "advance", heads: ["c"] }
  );
});
test("verified identities bind causal parents and tombstone state to the payload", async () => {
  const encoded = await encodeSyncRevision(
    { revision: "r", script: buildUserscriptFixture({ id: "one" }) },
    ["base"]
  );
  assert.equal(
    (
      await decodeSyncRevision(
        { ...encoded.manifest, parents: ["different"] },
        encoded.chunks
      )
    ).status,
    "corrupt"
  );
  assert.equal(
    (
      await decodeSyncRevision(
        { ...encoded.manifest, deleted: true },
        encoded.chunks
      )
    ).status,
    "corrupt"
  );
});
test("complete revision round trips Unicode and rejects incomplete or corrupt payloads", async () => {
  const document = {
    revision: "rev-1",
    script: buildUserscriptFixture({
      id: "one",
      name: "日本語 🙂",
      code: {
        source: { typescript: "const x = 1;".repeat(1000), scss: "" },
        compiled: { javascript: "", css: "" },
      },
    }),
  };
  const encoded = await encodeSyncRevision(document, []);
  const decoded = await decodeSyncRevision(encoded.manifest, encoded.chunks);
  assert.equal(decoded.status, "complete");
  assert.equal(decoded.document.script.name, "日本語 🙂");
  const missing = { ...encoded.chunks };
  delete missing[Object.keys(missing)[0]];
  assert.equal(
    (await decodeSyncRevision(encoded.manifest, missing)).status,
    "incomplete"
  );
  const corrupt = { ...encoded.chunks };
  corrupt[Object.keys(corrupt)[0]] = "AAAA";
  assert.equal(
    (await decodeSyncRevision(encoded.manifest, corrupt)).status,
    "corrupt"
  );
});
test("concurrent heads conflict, descendants advance, delayed ancestors cannot resurrect deletion", () => {
  const revisions = {
    a: { revision: "a", parents: [] },
    b: { revision: "b", parents: ["a"] },
    c: { revision: "c", parents: ["a"] },
    d: { revision: "d", parents: ["b", "c"], deleted: true },
  };
  assert.deepEqual(mergeSyncRevision(["b"], revisions.c, revisions), {
    status: "conflict",
    heads: ["b", "c"],
  });
  assert.deepEqual(mergeSyncRevision(["b", "c"], revisions.d, revisions), {
    status: "advance",
    heads: ["d"],
  });
  assert.deepEqual(mergeSyncRevision(["d"], revisions.a, revisions), {
    status: "duplicate",
    heads: ["d"],
  });
});
