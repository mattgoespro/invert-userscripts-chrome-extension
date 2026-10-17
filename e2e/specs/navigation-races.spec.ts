import { createServer, type ServerResponse } from "node:http";
import { test, expect, buildUserscript, buildGlobalModule } from "../fixtures";
import {
  buildCompiledLocalEntry,
  sendApplyScripts,
} from "../helpers/injection";
import { buildUserscriptSyncManifest } from "../fixtures/userscript-storage";

for (const change of ["disable", "navigate"] as const) {
  test(`a delayed CDN cannot inject after ${change}`, async ({
    optionsPage,
    extensionContext,
    clearStorage,
    seedStorage,
  }) => {
    let release: (() => void) | undefined;
    let entered!: () => void;
    const fetched = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const server = createServer((request, response: ServerResponse) => {
      if (request.url === "/slow.js") {
        release = () => {
          if (response.writableEnded) {
            return;
          }
          response.writeHead(200, { "Content-Type": "text/javascript" });
          response.end("window.delayedLibrary=true;");
        };
        entered();
      } else {
        response.writeHead(200, { "Content-Type": "text/html" });
        response.end(
          "<!doctype html><html><body>Document fixture</body></html>"
        );
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("No server port.");
    }
    const origin = "http://127.0.0.1:" + address.port;
    const module = buildGlobalModule({
      id: "slow",
      name: "Slow module",
      url: origin + "/slow.js",
      enabled: true,
      packageName: "",
    });
    const code = 'document.documentElement.setAttribute("data-delayed","ran");';
    const script = buildUserscript({
      name: "Delayed injection",
      shared: false,
      enabled: true,
      moduleName: "",
      globalModules: [module.id],
      urlPatterns: [origin + "/first"],
      code: {
        source: { typescript: code, scss: "html { opacity: 0.5; }" },
        compiled: { javascript: "", css: "" },
      },
    });
    const page = await extensionContext.newPage();
    try {
      await clearStorage(optionsPage);
      await seedStorage(
        optionsPage,
        {
          ["userscript:" + script.id]: script,
          globalModules: { [module.id]: module },
        },
        buildCompiledLocalEntry(script, {
          javascript: code,
          css: "html { opacity: 0.5; }",
        })
      );
      await page.goto(origin + "/first");
      await expect.poll(() => Boolean(release), { timeout: 5000 }).toBe(true);
      await fetched;

      if (change === "disable") {
        await optionsPage.evaluate((data) => chrome.storage.sync.set(data), {
          ["userscript:" + script.id]: buildUserscriptSyncManifest({
            ...script,
            enabled: false,
          }),
        });
      } else {
        await page.goto(origin + "/replacement");
      }
      release!();
      await sendApplyScripts(optionsPage, [script.id]);
      expect(await page.getAttribute("html", "data-delayed")).toBeNull();
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).opacity
        )
      ).toBe("1");
      expect(
        await page.evaluate(() =>
          Boolean(
            (window as Window & { delayedLibrary?: boolean }).delayedLibrary
          )
        )
      ).toBe(false);
    } finally {
      release?.();
      await page.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    }
  });
}
