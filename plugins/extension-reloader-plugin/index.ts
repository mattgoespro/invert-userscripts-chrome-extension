import webpack from "webpack";
import { WebSocket, WebSocketServer } from "ws";
import { parseClientFileContents } from "./client/load.ts";
import type {
  BroadcastMessage,
  ChromeExtensionReloaderPluginOptions,
} from "./model.ts";
import { type Logger, createLogger } from "./utils/logger.ts";

export default class ExtensionReloaderPlugin
  implements webpack.WebpackPluginInstance
{
  private readonly name = "ChromeExtensionReloaderWebpackPlugin";
  private readonly ChromeExtensionReloaderClientScriptName =
    "chrome-extension-reloader-client.js";

  private _options: ChromeExtensionReloaderPluginOptions;

  private _log: Logger;
  private _wss: WebSocketServer;
  private _clientReloaderScriptContent: string;

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

      this._log.verbose(
        "Build done. Broadcasting reload message to clients..."
      );
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

      this.sendBrowserClientMessage(ws, {
        type: "log",
        data: this._log.createMessage(
          "INFO",
          "Connected to Extension Reloader Plugin."
        ),
      });

      this._log.verbose("Sending initial configuration to the client...");

      this.sendBrowserClientMessage(ws, {
        type: "configure",
        data: {
          config: { consoleOptions: this._options.consoleOptions },
        },
      });

      ws.onmessage = this.onReceiveBrowserClientMessage.bind(this);
    });

    this._log.verbose(`Listening on port: ${this._options.port}`);
  }

  private broadcastMessageToClients(message: BroadcastMessage) {
    if (this._wss.clients.size === 0) {
      this._log.warn(`
        No extension clients are connected.
        Ensure that:
          > the browser extension is installed and activated
          > a browser window is running
      `);
    }

    const broadcastMessage = (message: BroadcastMessage) => {
      for (const client of this._wss.clients) {
        if (client.readyState !== WebSocket.OPEN) {
          throw new Error(
            "An existing client is not ready to receive messages. Skipping..."
          );
        }

        this.sendBrowserClientMessage(client, message);
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

  private sendBrowserClientMessage(
    client: WebSocket,
    message: BroadcastMessage
  ) {
    client.send(JSON.stringify(message));
  }

  private onReceiveBrowserClientMessage(message: MessageEvent) {
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
    // Emit the extension reloader client as an asset so that it can be linked as a script in HTML assets.
    compilation.emitAsset(
      this.ChromeExtensionReloaderClientScriptName,
      new webpack.sources.RawSource(this._clientReloaderScriptContent)
    );

    for (const name of Object.keys(assets)) {
      // Only inject into HTML assets that aren't explicitly excluded.
      if (
        !name.endsWith(".html") ||
        this._options.excludeAssets.includes(name)
      ) {
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
