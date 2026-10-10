import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCompilerRequests } from "../packages/renderer/src/sandbox/compiler-requests.ts";
import {
  connectBuildWorker,
  connectSassSandbox,
} from "../packages/renderer/src/sandbox/compiler-transports.ts";
import {
  initializeBuildWorker,
  SassCompiler,
  buildUserscriptJavascript,
  buildUserscriptStylesheet,
} from "../packages/renderer/src/sandbox/compiler.ts";

function fakeClock() {
  let now = 0,
    next = 0;
  const timers = new Map();
  return {
    setTimeout: (callback, delay) => {
      const id = ++next;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    advance: (delay) => {
      now += delay;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now && timers.delete(id)) {
          timer.callback();
        }
      }
    },
    timers,
  };
}
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function harness(overrides = {}) {
  const clock = fakeClock(),
    generations = [];
  const client = createCompilerRequests({
    initializationTimeoutMs: 15000,
    requestTimeoutMs: 30000,
    initializationTimeoutError: "initialization timeout",
    initializationFailureError: "initialization failed",
    requestTimeoutError: "request timeout",
    unavailableError: "unavailable",
    clock,
    connect: (events) => {
      const generation = { events, sent: [], closed: 0 };
      generations.push(generation);
      return {
        send: (id, input) => generation.sent.push({ id, input }),
        close: () => generation.closed++,
      };
    },
    ...overrides,
  });
  return { client, clock, generations };
}

describe("compiler request lifetime", () => {
  it("shares initialization and correlates out-of-order responses", async () => {
    const h = harness(),
      ready = h.client.initialize();
    assert.equal(h.client.initialize(), ready);
    const generation = h.generations[0];
    generation.events.ready();
    await ready;
    const a = h.client.request("a"),
      b = h.client.request("b");
    await tick();
    generation.events.result("unknown", { success: true, code: "ignored" });
    generation.events.result(generation.sent[1].id, {
      success: true,
      code: "B",
    });
    generation.events.result(generation.sent[0].id, {
      success: true,
      code: "A",
    });
    assert.equal((await a).code, "A");
    assert.equal((await b).code, "B");
    assert.equal(h.clock.timers.size, 0);
  });
  it("enforces initialization deadline, closes the attempt, and ignores old readiness", async () => {
    const h = harness(),
      ready = h.client.initialize(),
      rejected = assert.rejects(ready, /initialization timeout/);
    h.clock.advance(14999);
    assert.equal(h.generations[0].closed, 0);
    h.clock.advance(1);
    await rejected;
    assert.equal(h.generations[0].closed, 1);
    const retry = h.client.initialize();
    let settled = false;
    retry.then(() => {
      settled = true;
    });
    h.generations[0].events.ready();
    await tick();
    assert.equal(settled, false);
    h.generations[1].events.ready();
    await retry;
    assert.equal(h.clock.timers.size, 0);
  });
  it("retries after a synchronous constructor failure", async () => {
    let attempts = 0,
      events;
    const h = harness({
      connect: (value) => {
        if (++attempts === 1) {
          throw new Error("constructor failed");
        }
        events = value;
        return { send() {}, close() {} };
      },
    });
    await assert.rejects(h.client.initialize(), /constructor failed/);
    const retry = h.client.initialize();
    events.ready();
    await retry;
    assert.equal(attempts, 2);
    assert.equal(h.clock.timers.size, 0);
  });
  it("times out one request without resetting the transport or settling it twice", async () => {
    const h = harness(),
      ready = h.client.initialize();
    h.generations[0].events.ready();
    await ready;
    const request = h.client.request("slow");
    await tick();
    h.clock.advance(29999);
    assert.equal(h.clock.timers.size, 1);
    h.clock.advance(1);
    assert.equal((await request).error.message, "request timeout");
    h.generations[0].events.result(h.generations[0].sent[0].id, {
      success: true,
      code: "late",
    });
    assert.equal(h.generations[0].closed, 0);
    assert.equal(h.clock.timers.size, 0);
  });
  it("fails pending requests on transport failure and isolates the replacement", async () => {
    const h = harness(),
      ready = h.client.initialize();
    h.generations[0].events.ready();
    await ready;
    const request = h.client.request("pending");
    await tick();
    h.generations[0].events.failed(new Error("worker failed"));
    assert.equal((await request).error.message, "worker failed");
    const retry = h.client.initialize();
    h.generations[1].events.ready();
    await retry;
    h.generations[0].events.failed(new Error("old failure"));
    assert.equal(h.generations[1].closed, 0);
    assert.equal(h.clock.timers.size, 0);
  });
  it("preserves send rejection while releasing pending timers", async () => {
    let events;
    const h = harness({
      connect: (value) => {
        events = value;
        return {
          send() {
            throw new Error("send failed");
          },
          close() {},
        };
      },
    });
    const ready = h.client.initialize();
    events.ready();
    await ready;
    await assert.rejects(h.client.request("bad"), /send failed/);
    assert.equal(h.clock.timers.size, 0);
  });
  it("returns initialization failure as a compile result", async () => {
    const h = harness({
      connect() {
        throw new Error("offline");
      },
    });
    assert.equal((await h.client.request("input")).error.message, "offline");
  });
});

function browserHarness() {
  const previous = new Map(),
    listeners = new Set(),
    frames = new Set(),
    workers = [];
  const set = (key, value) => {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  };
  class Worker {
    listeners = new Map();
    sent = [];
    terminated = 0;
    constructor(url) {
      this.url = url;
      workers.push(this);
    }
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }
    removeEventListener(type) {
      this.listeners.delete(type);
    }
    postMessage(message) {
      this.sent.push(message);
    }
    terminate() {
      this.terminated++;
    }
    emit(type, value) {
      this.listeners.get(type)?.(value);
    }
  }
  set("Worker", Worker);
  set("chrome", {
    runtime: { getURL: (path) => `chrome-extension://test/${path}` },
  });
  set("window", {
    addEventListener: (_type, handler) => listeners.add(handler),
    removeEventListener: (_type, handler) => listeners.delete(handler),
  });
  set("document", {
    createElement: () => {
      const sent = [];
      return {
        style: {},
        sent,
        contentWindow: { postMessage: (...args) => sent.push(args) },
        remove() {
          frames.delete(this);
        },
      };
    },
    body: { appendChild: (frame) => frames.add(frame) },
  });
  return {
    workers,
    frames,
    listeners,
    set,
    emit: (source, data) => {
      for (const handler of listeners) {
        handler({ source, data });
      }
    },
    restore: () => {
      for (const [key, descriptor] of previous) {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          delete globalThis[key];
        }
      }
    },
  };
}

describe("compiler browser adapters", () => {
  it("retains worker protocol, errors, and termination", () => {
    const h = browserHarness(),
      results = [],
      failures = [];
    try {
      const transport = connectBuildWorker({
        ready: () => results.push("ready"),
        result: (id, result) => results.push({ id, result }),
        failed: (error) => failures.push(error.message),
      });
      const worker = h.workers[0];
      assert.equal(worker.url, "chrome-extension://test/build-worker.js");
      worker.emit("message", { data: { type: "worker-ready" } });
      transport.send("id", {
        sourceCode: "let a = 1",
        shared: true,
        moduleName: "module",
        minify: true,
      });
      assert.deepEqual(worker.sent[0], {
        type: "compile",
        id: "id",
        sourceCode: "let a = 1",
        shared: true,
        moduleName: "module",
        minify: true,
      });
      worker.emit("message", {
        data: { type: "compile-result", id: "id", success: false },
      });
      assert.equal(
        results[1].result.error.message,
        "Unknown compilation error"
      );
      worker.emit("error", { message: "crash" });
      assert.deepEqual(failures, ["crash"]);
      transport.close();
      assert.equal(worker.terminated, 1);
      assert.equal(worker.listeners.size, 0);
    } finally {
      h.restore();
    }
  });
  it("filters Sass messages by the captured iframe and removes resources", () => {
    const h = browserHarness(),
      results = [];
    try {
      const transport = connectSassSandbox({
        ready: () => results.push("ready"),
        result: (id, result) => results.push({ id, result }),
        failed() {},
      });
      const frame = [...h.frames][0];
      h.emit({}, { type: "sandbox-ready" });
      assert.deepEqual(results, []);
      h.emit(frame.contentWindow, { type: "sandbox-ready" });
      assert.deepEqual(results, ["ready"]);
      transport.send("id", { scss: "a {}", minify: true });
      assert.deepEqual(frame.sent[0], [
        { type: "compile", id: "id", scss: "a {}", minify: true },
        "*",
      ]);
      h.emit(frame.contentWindow, {
        type: "compile-result",
        id: "id",
        success: true,
        css: "a{}",
      });
      assert.equal(results[1].result.code, "a{}");
      transport.close();
      assert.equal(h.frames.size, 0);
      assert.equal(h.listeners.size, 0);
    } finally {
      h.restore();
    }
  });
  it("preserves public initialization/JS/SCSS deadlines and cleans failed sandbox attempts", async () => {
    const h = browserHarness(),
      clock = fakeClock();
    h.set("setTimeout", clock.setTimeout);
    h.set("clearTimeout", clock.clearTimeout);
    try {
      const failed = assert.rejects(
        SassCompiler.initialize(),
        /within 15 seconds/
      );
      clock.advance(14999);
      assert.equal(h.frames.size, 1);
      clock.advance(1);
      await failed;
      assert.equal(h.frames.size, 0);
      assert.equal(h.listeners.size, 0);
      const sassReady = SassCompiler.initialize(),
        frame = [...h.frames][0];
      h.emit(frame.contentWindow, { type: "sandbox-ready" });
      await sassReady;
      const css = buildUserscriptStylesheet("a {}", {
        minifyCompiledOutput: true,
      });
      await tick();
      clock.advance(9999);
      assert.equal(clock.timers.size, 1);
      clock.advance(1);
      assert.equal((await css).error.message, "SCSS compilation timed out.");
      const jsReady = initializeBuildWorker(),
        worker = h.workers[0];
      worker.emit("message", { data: { type: "worker-ready" } });
      await jsReady;
      const js = buildUserscriptJavascript(
        { id: "test", shared: false, moduleName: "test" },
        "const a = 1",
        { minifyCompiledOutput: false }
      );
      await tick();
      clock.advance(29999);
      assert.equal(clock.timers.size, 1);
      clock.advance(1);
      assert.equal(
        (await js).error.message,
        "JavaScript compilation timed out."
      );
      worker.emit("error", { message: "stop" });
      assert.equal(clock.timers.size, 0);
    } finally {
      h.restore();
    }
  });
});
