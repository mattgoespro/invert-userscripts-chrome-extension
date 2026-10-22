import assert from "node:assert/strict";
import test from "node:test";
import {
  GoogleDriveTransport,
  encodeDriveFile,
  decodeDriveFile,
} from "../packages/runtime/src/drive/transport.ts";
const records = [
  {
    kind: "settings",
    revision: "settings-1",
    parents: [],
    value: { fontSize: 18 },
  },
];
test("the Drive client preserves the browser global receiver required by native fetch", async () => {
  // Chromium worker.fetch throws Illegal invocation with a class instance receiver.
  function scopedFetch() {
    if (this !== globalThis) {
      throw new TypeError("Illegal invocation");
    }
    return Promise.resolve(
      Response.json({ files: [{ id: "native-request" }] })
    );
  }
  const client = new GoogleDriveTransport(
    "token",
    new AbortController().signal,
    scopedFetch
  );
  assert.deepEqual(await client.list(), ["native-request"]);
});
test("compressed Drive files validate integrity and reject corruption before hydration", async () => {
  const bytes = await encodeDriveFile(records);
  assert.deepEqual(await decodeDriveFile(bytes), records);
  const damaged = bytes.slice();
  damaged[damaged.length - 5] ^= 255;
  await assert.rejects(() => decodeDriveFile(damaged));
});
test("Drive discovery follows every page and scopes requests to application data", async () => {
  const requests = [];
  const client = new GoogleDriveTransport(
    "token",
    new AbortController().signal,
    async (url) => {
      requests.push(String(url));
      return Response.json(
        requests.length === 1
          ? { files: [{ id: "one" }], nextPageToken: "next" }
          : { files: [{ id: "two" }] }
      );
    }
  );
  assert.deepEqual(await client.list(), ["one", "two"]);
  assert.equal(
    new URL(requests[0]).searchParams.get("spaces"),
    "appDataFolder"
  );
  assert.equal(new URL(requests[1]).searchParams.get("pageToken"), "next");
});
test("a retried immutable upload accepts 409 only when the existing content matches", async () => {
  let different = false;
  const client = new GoogleDriveTransport(
    "token",
    new AbortController().signal,
    async (url, init) =>
      init?.method === "POST"
        ? new Response(null, { status: 409 })
        : new Response(
            await encodeDriveFile(
              different ? [{ ...records[0], value: { fontSize: 12 } }] : records
            )
          )
  );
  await client.upload("generated-id", records);
  different = true;
  await assert.rejects(
    () => client.upload("generated-id", records),
    /content/i
  );
});
test("401 invalidates the token and cannot be reported as successful delivery", async () => {
  let removed = false;
  const client = new GoogleDriveTransport(
    "token",
    new AbortController().signal,
    async () => new Response(null, { status: 401 }),
    async () => {
      removed = true;
    }
  );
  await assert.rejects(() => client.list(), /reconnect/i);
  assert.equal(removed, true);
});
