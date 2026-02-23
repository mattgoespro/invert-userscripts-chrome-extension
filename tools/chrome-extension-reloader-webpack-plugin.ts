import webpack from "webpack";
import { WebSocket, WebSocketServer } from "ws";
import {
  type Logger,
  createLogger,
  loadReloaderClient,
} from "./chrome-extension-reloader-plugin-utils.ts";

export type CaptureConsoleOptions = {
  levels: ("log" | "info" | "warn" | "error")[];
  ignore?: (...message: unknown[]) => boolean;
};

export interface ChromeExtensionReloaderPluginOptions {
  port?: number;
  verbose?: boolean;
  autoLaunchBrowser?: boolean;
  captureConsole?: boolean | CaptureConsoleOptions;
}

type BroadcastMessage = {
  type: "configure" | "reload" | "log";
  data?: unknown;
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
      captureConsole: options.captureConsole ?? false,
    };

    this._clientReloaderScriptContent = loadReloaderClient([
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

    compiler.hooks.done.tap(this.name, () => {
      this.broadcastClientMessage({ type: "reload" });
    });

    compiler.hooks.shutdown.tap(this.name, () => {
      this._wss.close();
    });
  }

  private startWebsocketServer() {
    this._wss = new WebSocketServer({ port: this._options.port });

    this._wss.on("connection", (ws) => {
      this._log.verbose("Extension client connected from the browser.");

      this.broadcastClientMessage({
        type: "log",
        data: this._log.createMessage("INFO", "Connected to Chrome Extension Reloader."),
      });
      this.broadcastClientMessage({
        type: "configure",
        data: {
          captureConsole: this._options.captureConsole,
        },
      });

      ws.onmessage = this.onClientMessage.bind(this);
    });

    this._log.verbose(`Listening on port: ${this._options.port}`);
  }

  private broadcastClientMessage(message: BroadcastMessage) {
    const sendMessageToClients = (message: BroadcastMessage) => {
      for (const client of this._wss.clients) {
        if (client.readyState !== WebSocket.OPEN) {
          this._log.warn("An existing client is not ready to receive messages. Skipping...");
          continue;
        }

        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      }
    };

    switch (message.type) {
      case "configure": {
        sendMessageToClients(message);
        this._log.verbose("Sent configuration to extension client.");
        break;
      }
      case "reload": {
        this._log.info("Reloading extension...");
        sendMessageToClients(message);
        this._log.info("Reload complete.");
        break;
      }
      case "log": {
        sendMessageToClients(message);
        break;
      }
    }
  }

  private onClientMessage(message: MessageEvent) {
    try {
      const msg: BroadcastMessage = JSON.parse(message.data.toString());

      if (msg.type === "log") {
        this._log.info(msg.data as string);
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
