import webpack from "webpack";
import { WebSocket, WebSocketServer } from "ws";
import { parseClientFileContents } from "./client/load.ts";
import type { BroadcastMessage, ChromeExtensionReloaderPluginOptions } from "./model.ts";
import { type Logger, createLogger } from "./utils/logger.ts";

export default class ExtensionReloaderPlugin implements webpack.WebpackPluginInstance {
  private readonly name = "ChromeExtensionReloaderWebpackPlugin";
  private readonly ChromeExtensionReloaderClientScriptName = "chrome-extension-reloader-client.js";

  private _log: Logger;
  private _wss: WebSocketServer;
  private _clientReloaderScriptContent: string;

  private _options: ChromeExtensionReloaderPluginOptions;

  constructor(options: ChromeExtensionReloaderPluginOptions = {}) {
    this._options = {
      port: options.port ?? 8081,
      verbose: options.verbose ?? false,
      autoLaunchBrowser: options.autoLaunchBrowser ?? false,
      excludeAssets: options.excludeAssets ?? [],
      consoleOptions: options.consoleOptions,
    };

    this._clientReloaderScriptContent = parseClientFileContents([
      ["port", this._options.port.toString()],
    ]);

    this._log = createLogger(this.name, {
      verbose: this._options.verbose,
    });

    this.startWebsocketServer();
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

    compiler.hooks.done.tap(this.name, (stats) => {
      if (stats.hasErrors()) {
        this._log.error("Build failed with errors. Skipping reload.");
        return;
      }

      this._log.verbose("Build done. Broadcasting reload message to clients...");
      this.broadcastMessageToClients({ type: "reload" });
    });

    compiler.hooks.shutdown.tap(this.name, () => {
      this._wss.close();
    });
  }

  private startWebsocketServer() {
    this._wss = new WebSocketServer({ port: this._options.port });

    this._wss.on("connection", (ws) => {
      this._log.verbose("Extension client connected from the browser.");
      this._log.verbose("Sending connection message to the client...");
      ws.send(
        JSON.stringify({
          type: "log",
          data: this._log.createMessage("INFO", "Connected to the Extension Reloader Plugin."),
        })
      );

      this._log.verbose("Sending initial configuration to the client...");
      ws.send(
        JSON.stringify({
          type: "configure",
          data: {
            config: { consoleOptions: this._options.consoleOptions },
          },
        })
      );

      ws.onmessage = this.onReceiveClientMessage.bind(this);
    });

    this._log.verbose(`Listening on port: ${this._options.port}`);
  }

  private broadcastMessageToClients(message: BroadcastMessage) {
    const broadcastMessage = (message: BroadcastMessage) => {
      for (const client of this._wss.clients) {
        if (client.readyState !== WebSocket.OPEN) {
          this._log.verbose("An existing client is not ready to receive messages. Skipping...");
          continue;
        }

        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    };

    switch (message.type) {
      case "configure": {
        broadcastMessage(message);
        this._log.verbose("Sent configuration to extension clients.");
        break;
      }
      case "reload": {
        this._log.info("Reloading extension...");
        broadcastMessage(message);
        this._log.info("Reload complete.");
        break;
      }
      case "log": {
        broadcastMessage(message);
        break;
      }
    }
  }

  private onReceiveClientMessage(message: MessageEvent) {
    try {
      const { type, data } = JSON.parse(message.data.toString());

      switch (type) {
        case "log": {
          const { level, message } = data;

          switch (level) {
            case "info":
              this._log.info(message);
              break;
            case "warn":
              this._log.warn(message);
              break;
            case "error":
              this._log.error(message);
              break;
          }
          break;
        }
      }
    } catch (error) {
      this._log.error("Failed to parse message from client:");
      this._log.error(error);
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

    for (const name of Object.keys(assets)) {
      if (!name.endsWith(".html") || this._options.excludeAssets.includes(name)) {
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
