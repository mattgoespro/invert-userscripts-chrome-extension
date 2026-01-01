import webpack from "webpack";
import { WebSocket, WebSocketServer } from "ws";
import { createLogger, loadReloaderClient } from "./chrome-extension-reloader-plugin-utils.ts";
import type { Logger } from "./chrome-extension-reloader-plugin-utils.ts";

export interface ChromeExtensionReloaderPluginOptions {
  port?: number;
  verbose?: boolean;
  autoLaunchBrowser?: boolean;
}

type BroadcastMessage = {
  type: "reload" | "log";
  data?: string;
};

export class ChromeExtensionReloaderWebpackPlugin implements webpack.WebpackPluginInstance {
  private readonly name = "ChromeExtensionReloaderWebpackPlugin";
  private readonly ChromeExtensionReloaderClientScriptName = "chrome-extension-reloader-client.js";

  private _log: Logger;
  private _wss: WebSocketServer;
  private _clientReloaderScriptContent: string;

  private _options: ChromeExtensionReloaderPluginOptions;

  constructor(options: ChromeExtensionReloaderPluginOptions = {}) {
    this._options = {
      ...options,
      port: options.port ?? 8081,
      verbose: options.verbose ?? false,
      autoLaunchBrowser: options.autoLaunchBrowser ?? false,
    };

    this._clientReloaderScriptContent = loadReloaderClient([
      ["port", this._options.port.toString()],
    ]);

    this._log = createLogger(this.name, {
      verbose: this._options.verbose,
    });

    this.startPluginWebsocketServer();
  }

  /**
   * Applies the plugin to the Webpack compiler.
   */
  apply(compiler: webpack.Compiler) {
    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (assets) => this.injectAssetClientReloader(compilation, assets)
      );
    });

    compiler.hooks.done.tap(this.name, () => {
      this.broadcastExtClientMessage({ type: "reload" });
    });

    compiler.hooks.shutdown.tap(this.name, () => {
      this._wss.close();
    });
  }

  private startPluginWebsocketServer() {
    this._wss = new WebSocketServer({ port: this._options.port });

    this._wss.on("connection", () => {
      this._log.verbose("Extension client connected from the browser.");

      this.broadcastExtClientMessage({
        type: "log",
        data: this._log.createMessage("INFO", "Connected to Chrome Extension Reloader."),
      });
    });

    this._log.verbose(`Listening on port: ${this._options.port}`);
  }

  private broadcastExtClientMessage(message: BroadcastMessage) {
    const sendMessageToClients = (message: BroadcastMessage) => {
      for (const client of this._wss.clients) {
        if (client.readyState !== WebSocket.OPEN) {
          this._log.verbose("An existing client is not ready.");
          continue;
        }

        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    };

    switch (message.type) {
      case "reload": {
        this._log.info("Reloading extension...");
        sendMessageToClients(message);
        this._log.info("Reload complete.");
        break;
      }
      case "log": {
        sendMessageToClients(message);
      }
    }
  }

  private injectAssetClientReloader(
    compilation: webpack.Compilation,
    assets: Record<string, webpack.sources.Source>
  ) {
    // Emit the extension reloader client as an asset so that it can be linked as a script in the HTML templates.
    compilation.emitAsset(
      this.ChromeExtensionReloaderClientScriptName,
      new webpack.sources.RawSource(this._clientReloaderScriptContent)
    );

    // Insert the client script into all HTML assets.
    for (const name of Object.keys(assets)) {
      if (!name.endsWith(".html")) {
        continue;
      }

      const src = assets[name].source().toString();
      const out = src.replace(
        "</body>",
        `\t<script src="${this.ChromeExtensionReloaderClientScriptName}"></script>
        </body>`
      );

      compilation.updateAsset(name, new webpack.sources.RawSource(out));
    }
  }
}
