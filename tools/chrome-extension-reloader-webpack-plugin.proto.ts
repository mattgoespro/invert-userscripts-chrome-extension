import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import webpack from 'webpack';
import { WebSocket, WebSocketServer } from 'ws';
import type { Logger } from './chrome-extension-reloader-plugin-utils.proto.ts';
import {
  createLogger,
  launchChromeProcess,
  loadReloaderClient,
} from './chrome-extension-reloader-plugin-utils.proto.ts';

export interface ChromeExtensionReloaderPluginOptions {
  port?: number;
  autoLaunchBrowser?: boolean;
  verbose?: boolean;
}

export class ChromeExtensionReloaderWebpackPlugin implements webpack.WebpackPluginInstance {
  private readonly name = 'ChromeExtensionReloaderWebpackPlugin';
  private readonly cacheDir = path.join(
    process.cwd(),
    'node_modules',
    '.cache',
    'chrome-extension-reloader-webpack-plugin'
  );

  private _log: Logger;
  private _options: ChromeExtensionReloaderPluginOptions;
  private _extensionPath: string;
  private _extensionId: string;
  private _manifestKey: string;
  private _wss: WebSocketServer = null;
  private _reloader: NodeJS.Timeout = null;
  private _lastClientDisconnect: number = 0;

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = this.normalizeOptions(options);
    this._log = createLogger(this.name, { prefix: this.name, verbose: this._options.verbose });

    this.setPluginExtensionMetadata();
    this.startReloadServer();
  }

  private normalizeOptions(
    options: ChromeExtensionReloaderPluginOptions
  ): ChromeExtensionReloaderPluginOptions {
    return {
      port: options.port ?? 8081,
      autoLaunchBrowser: options.autoLaunchBrowser ?? false,
      verbose: options.verbose ?? false,
    };
  }

  private startReloadServer() {
    this._wss = new WebSocketServer({
      port: this._options.port,
    });

    this._wss
      .on('listening', () => {
        this._log.info(`Extension reload server listening on port: ${this._options.port}`);
      })
      .on('connection', (ws) => {
        this._log.info(`Connected.`);

        ws.on('close', () => {
          this._log.verbose('Extension websocket disconnected.');
          this._lastClientDisconnect = Date.now();
        }).on('error', (err) =>
          this._log.error(`Extension websocket encountered an error: ${err.message}`)
        );
      })
      .on('error', (err) => {
        this._log.error(`Extension reload server encountered an error: ${err.message}`);
      });
  }

  /**
   * Apply the extension reloader plugin to the Webpack compiler so that it integrates into the webpack build lifecycle.
   *
   * @param compiler The Webpack compiler instance.
   */
  async apply(compiler: webpack.Compiler) {
    this._extensionPath = compiler.options.output.path;

    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (assets) => {
          const manifestName = 'manifest.json';
          const manifestAsset = assets['manifest.json'];
          let manifestContent: chrome.runtime.ManifestV3;

          if (manifestAsset != null) {
            const source = manifestAsset.source().toString();

            manifestContent = JSON.parse(source);
            manifestContent.key = this._manifestKey;

            if (manifestContent.content_security_policy?.extension_pages) {
              const csp = manifestContent.content_security_policy.extension_pages;
              const wsUrl = `ws://localhost:${this._options.port}`;

              if (csp.includes('connect-src')) {
                manifestContent.content_security_policy.extension_pages = csp.replace(
                  'connect-src',
                  `connect-src ${wsUrl}`
                );
              } else {
                manifestContent.content_security_policy.extension_pages =
                  `${csp}; connect-src 'self' ${wsUrl}`.replace(/;;/g, ';');
              }
            }

            compilation.updateAsset(
              manifestName,
              new webpack.sources.RawSource(JSON.stringify(manifestContent, null, 2))
            );
          }

          const clientReloaderScriptContent = loadReloaderClient([
            ['websocketPort', this._options.port.toString()],
          ]);

          const reloaderScriptName = 'reloader-client.js';
          compilation.emitAsset(
            reloaderScriptName,
            new webpack.sources.RawSource(clientReloaderScriptContent)
          );

          if (manifestContent?.background?.service_worker != null) {
            const manifestServiceWorkerName = manifestContent.background.service_worker;
            const buildServiceWorkerAsset = compilation.assets[manifestServiceWorkerName];

            if (buildServiceWorkerAsset != null) {
              compilation.updateAsset(
                manifestServiceWorkerName,
                new webpack.sources.RawSource(
                  `${clientReloaderScriptContent}\n\n${buildServiceWorkerAsset.source().toString()}`
                )
              );
            }
          }

          Object.keys(assets).forEach((assetName) => {
            if (assetName.endsWith('.html')) {
              const asset = assets[assetName];
              const content = asset.source().toString();
              const newContent = content.replace(
                '</body>',
                `<script src="${reloaderScriptName}"></script></body>`
              );

              compilation.updateAsset(assetName, new webpack.sources.RawSource(newContent));
            }
          });
        }
      );
    });

    compiler.hooks.done.tapAsync(this.name, async (stats, done) => {
      if (Object.keys(stats.compilation.assets).length > 0) {
        this._log.verbose(`Compilation complete. Scheduling reload...`);
        this.scheduleReload();
      }

      // launch the browser only if configured to auto-launch and the browser is not already running (i.e it has no active client connections)
      if (this._options.autoLaunchBrowser && !this.isConnected()) {
        this.launchBrowser();
      }

      done();
    });

    compiler.hooks.shutdown.tap(this.name, async () => {
      this._wss.close();
      this._log.verbose('Server closed');
    });
  }

  private isConnected(): boolean {
    const connected = Array.from(this._wss.clients).some(
      (client) => client.readyState === WebSocket.OPEN
    );

    if (connected) {
      return true;
    }

    const RECONNECT_GRACE_PERIOD = 2000;
    if (
      this._lastClientDisconnect > 0 &&
      Date.now() - this._lastClientDisconnect < RECONNECT_GRACE_PERIOD
    ) {
      return true;
    }

    return false;
  }

  private scheduleReload(): void {
    if (this._reloader != null) {
      this._log.verbose(`Clearing pending reload...`);
      clearTimeout(this._reloader);
    }

    this._reloader = setTimeout(() => {
      this.broadcastReload();
      this._reloader = null;
    }, 1000);
  }

  private broadcastReload() {
    this._log.verbose('Reloading extension...');

    this._wss.clients.forEach((client) => {
      if (client.readyState !== WebSocket.OPEN) {
        this._log.warn('Skipped reloading disconnected client.');
        return;
      }

      client.send('reload');
    });

    this._log.info('Reload complete.');
  }

  private async launchBrowser() {
    try {
      this._log.info('Launching Chrome...');
      const browser = launchChromeProcess({
        extensionPath: this._extensionPath,
        page: `chrome-extension://${this._extensionId}/options.html`,
      });

      // detach the browser process so that the plugin can continue without waiting for it to exit
      browser.unref();
    } catch (e) {
      this._log.error(`Failed to launch browser: ${e.message}`);
    }
  }

  private setPluginExtensionMetadata() {
    fs.ensureDirSync(this.cacheDir);

    const keyPath = path.join(this.cacheDir, 'key.pem');

    if (fs.existsSync(keyPath)) {
      const privateKeyPem = fs.readFileSync(keyPath, 'utf8');
      const keyObject = crypto.createPrivateKey(privateKeyPem);
      const publicKeyObject = crypto.createPublicKey(keyObject);
      const publicKeyDer = publicKeyObject.export({ type: 'spki', format: 'der' });

      this._manifestKey = publicKeyDer.toString('base64');
      this._extensionId = this.calculateExtensionId(publicKeyDer);

      this._log.verbose(`Extension ID: ${this._extensionId}`);
      this._log.verbose(`Manifest key: ${this._manifestKey.slice(0, 32)}...`);
      return;
    }

    this._log.verbose(`Generating a new manifest key...`);

    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    fs.writeFileSync(keyPath, keyPair.privateKey);

    this._manifestKey = keyPair.publicKey.toString('base64');
    this._extensionId = this.calculateExtensionId(keyPair.publicKey);

    this._log.verbose(`Extension ID: ${this._extensionId}`);
    this._log.verbose(`Manifest key: ${this._manifestKey.slice(0, 32)}...`);
  }

  private calculateExtensionId(publicKey: Buffer): string {
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex');
    const first128Bits = hash.slice(0, 32);

    return first128Bits
      .split('')
      .map((char) => {
        const code = parseInt(char, 16);
        return String.fromCharCode(97 + code);
      })
      .join('');
  }
}
