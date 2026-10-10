import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { startIdeWorkspace } from "../packages/renderer/src/shared/services/ide-workspace-lifetime.ts";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
function harness() {
  const loads = deferred(),
    rebuild = deferred(),
    calls = [];
  const stop = startIdeWorkspace({
    initialize: () => {
      calls.push("load");
      return loads.promise;
    },
    attachWorkspace: () => {
      calls.push("attach");
      return () => calls.push("detach");
    },
    rebuildStaleArtifacts: () => {
      calls.push("rebuild");
      return rebuild.promise;
    },
    markReady: () => calls.push("ready"),
    reportError: (error) => calls.push(error.message),
  });
  return { loads, rebuild, calls, stop };
}
describe("IDE workspace lifetime", () => {
  it("starts synchronization after loads, then publishes readiness after rebuilding", async () => {
    const h = harness();
    h.loads.resolve();
    await tick();
    assert.deepEqual(h.calls, ["load", "attach", "rebuild"]);
    h.rebuild.resolve();
    await tick();
    h.stop();
    h.stop();
    assert.deepEqual(h.calls, ["load", "attach", "rebuild", "ready", "detach"]);
  });
  it("does not attach or publish readiness after disposal during loading", async () => {
    const h = harness();
    h.stop();
    h.loads.resolve();
    await tick();
    assert.deepEqual(h.calls, ["load"]);
  });
  it("stops synchronization immediately during rebuild and suppresses late readiness", async () => {
    const h = harness();
    h.loads.resolve();
    await tick();
    h.stop();
    assert.equal(h.calls.at(-1), "detach");
    h.rebuild.resolve();
    await tick();
    assert.ok(!h.calls.includes("ready"));
  });
  it("retains readiness on active initialization failure", async () => {
    const h = harness();
    h.loads.reject(new Error("load failed"));
    await tick();
    assert.deepEqual(h.calls, ["load", "load failed", "ready"]);
    h.stop();
  });
  it("cannot attach or dispose a replacement session after cleanup/remount", async () => {
    const old = harness();
    old.stop();
    const current = harness();
    current.loads.resolve();
    await tick();
    old.loads.resolve();
    await tick();
    old.stop();
    assert.deepEqual(old.calls, ["load"]);
    assert.deepEqual(current.calls, ["load", "attach", "rebuild"]);
    current.rebuild.resolve();
    await tick();
    current.stop();
  });
});
