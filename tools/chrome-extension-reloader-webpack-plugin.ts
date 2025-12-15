import fs from 'fs';
import path from 'path';
import webpack from 'webpack';
import { WebSocket, WebSocketServer } from 'ws';
import { createLogger } from './chrome-extension-reloader-plugin-utils.ts';
import type { Logger } from './chrome-extension-reloader-plugin-utils.ts';

export interface ChromeExtensionReloaderPluginOptions {
  port?: number;
  verbose?: boolean;
}

export class ChromeExtensionReloaderWebpackPlugin implements webpack.WebpackPluginInstance {
  private readonly name = 'ChromeExtensionReloaderWebpackPlugin';
  private log: Logger;
  private port: number;
  private wss: WebSocketServer;

  constructor({ port, verbose }: ChromeExtensionReloaderPluginOptions = {}) {
    this.log = createLogger(this.name, {
      verbose: verbose,
    });
    this.port = port ?? 8081;

    this.startWebSocketServer();
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (assets) => this.injectExtensionPageClient(compilation, assets)
      );
    });

    compiler.hooks.done.tap(this.name, () => {
      this.broadcastExtensionMessage({ type: 'reload' });
    });

    compiler.hooks.shutdown.tap(this.name, () => {
      this.wss.close();
    });
  }

  // ------------------------------
  // WebSocket
  // ------------------------------

  private startWebSocketServer() {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', () => {
      this.log.verbose('Extension client connected.');
    });

    this.log.verbose(`Websocket listening on port ${this.port}`);
  }

  private broadcastExtensionMessage(payload: unknown) {
    this.log.info('Reloading...');

    const msg = JSON.stringify(payload);

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  private injectExtensionPageClient(
    compilation: webpack.Compilation,
    assets: Record<string, webpack.sources.Source>
  ) {
    let clientCode = fs.readFileSync(
      path.join(import.meta.dirname, 'chrome-extension-reloader-client.js'),
      'utf-8'
    );

    clientCode = clientCode.replace(/{{port}}/g, this.port.toString());

    // Emit the inlined client as an asset
    compilation.emitAsset('reloader-client.js', new webpack.sources.RawSource(clientCode));

    // Inject the client script into HTML assets
    for (const name of Object.keys(assets)) {
      if (!name.endsWith('.html')) continue;

      const src = assets[name].source().toString();
      const out = src.replace('</body>', `<script src="reloader-client.js"></script></body>`);

      compilation.updateAsset(name, new webpack.sources.RawSource(out));
    }
  }
}
