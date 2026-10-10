import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasSharedJavascriptConfigChanged,
  resolveSharedScriptIdsFromSourceOrThrow,
} from "../packages/shared/src/resolve-shared-scripts.ts";

describe("resolveSharedScriptIdsFromSourceOrThrow", () => {
  it("resolves scripts/<module>/main imports to shared script ids", () => {
    const scriptsMap = {
      shared: {
        id: "shared",
        shared: true,
        moduleName: "utils",
        name: "Utils",
      },
      consumer: {
        id: "consumer",
        shared: false,
        moduleName: "app",
        name: "App",
      },
    };

    const ids = resolveSharedScriptIdsFromSourceOrThrow(
      scriptsMap.consumer,
      scriptsMap,
      `import { x } from "scripts/utils/main";`
    );

    assert.deepEqual(ids, ["shared"]);
  });

  it("skips unknown scripts/<module>/main imports so source can still save", () => {
    const ids = resolveSharedScriptIdsFromSourceOrThrow(
      { id: "a", name: "A", shared: false },
      {},
      `import { x } from "scripts/missing/main";`
    );

    assert.deepEqual(ids, []);
  });

  it("keeps shared imports while skipping unknown ones", () => {
    const scriptsMap = {
      shared: {
        id: "shared",
        shared: true,
        moduleName: "utils",
        name: "Utils",
      },
      consumer: {
        id: "consumer",
        shared: false,
        moduleName: "",
        name: "App",
      },
    };

    const ids = resolveSharedScriptIdsFromSourceOrThrow(
      scriptsMap.consumer,
      scriptsMap,
      `import { x } from "scripts/utils/main";
import { y } from "scripts/missing/main";`
    );

    assert.deepEqual(ids, ["shared"]);
  });

  it("skips imports of userscripts that are not shared", () => {
    const exporterId = "a8ee5963-bf40-462a-a423-d613e70fc13b";
    const scriptsMap = {
      [exporterId]: {
        id: exporterId,
        shared: false,
        moduleName: exporterId,
        name: "Logger",
      },
      consumer: {
        id: "consumer",
        shared: false,
        moduleName: "",
        name: "DOM Interaction | Utilities",
      },
    };

    const ids = resolveSharedScriptIdsFromSourceOrThrow(
      scriptsMap.consumer,
      scriptsMap,
      `import { createLogger } from "scripts/${exporterId}/main";`
    );

    assert.deepEqual(ids, []);
  });

  it("throws when a script imports itself as a shared module", () => {
    assert.throws(
      () =>
        resolveSharedScriptIdsFromSourceOrThrow(
          { id: "utils", name: "Utils", shared: true, moduleName: "utils" },
          {
            utils: {
              id: "utils",
              name: "Utils",
              shared: true,
              moduleName: "utils",
            },
          },
          `import { x } from "scripts/utils/main";`
        ),
      /cannot import itself/
    );
  });
});

describe("hasSharedJavascriptConfigChanged", () => {
  it("returns true when sharedScripts differ", () => {
    assert.equal(
      hasSharedJavascriptConfigChanged(
        { shared: true, moduleName: "a", sharedScripts: ["x"] },
        { shared: true, moduleName: "a", sharedScripts: ["y"] }
      ),
      true
    );
  });

  it("returns false when shared config is unchanged", () => {
    assert.equal(
      hasSharedJavascriptConfigChanged(
        { shared: true, moduleName: "a", sharedScripts: ["x"] },
        { shared: true, moduleName: "a", sharedScripts: ["x"] }
      ),
      false
    );
  });
});
