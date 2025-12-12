import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import webpack from 'webpack';
import { WebSocket, WebSocketServer } from 'ws';
import type { Logger } from './utils.ts';
import { createLogger, resolveChromeExecutablePath } from './utils.ts';

export interface ChromeExtensionReloaderPluginOptions {
  port?: number;
  autoLaunchBrowser?: boolean;
  openBrowserPage?: string;
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

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = this.normalizeOptions(options);
    this._log = createLogger(this.name, { prefix: this.name, verbose: this._options.verbose });

    this.writePluginExtensionMetadata();
    this.startReloadServer();
  }

  private normalizeOptions(
    options: ChromeExtensionReloaderPluginOptions
  ): ChromeExtensionReloaderPluginOptions {
    return {
      port: options.port ?? 8081,
      autoLaunchBrowser: options.autoLaunchBrowser ?? false,
      openBrowserPage: options.openBrowserPage ?? 'options.html',
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

        ws.on('close', () => this._log.verbose('Websocket to extension disconnected.')).on(
          'error',
          (err) => this._log.error(`Websocket to extension encountered an error: ${err.message}`)
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
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          const manifestName = 'manifest.json';
          const asset = compilation.assets[manifestName];
          let manifest: chrome.runtime.ManifestV3;

          if (asset != null) {
            const source = asset.source().toString();
            manifest = JSON.parse(source);
            manifest.key = this._manifestKey;
            const newSource = JSON.stringify(manifest, null, 2);

            compilation.updateAsset(manifestName, new webpack.sources.RawSource(newSource));
          }

          const clientReloaderScriptContent = fs
            .readFileSync(path.join(import.meta.dirname, 'client-reloader.js'), 'utf8')
            .replace('{{websocketPort}}', this._options.port.toString());

          if (manifest?.background?.service_worker != null) {
            const serviceWorkerName = manifest.background.service_worker;
            const serviceWorkerAsset = compilation.assets[serviceWorkerName];

            if (serviceWorkerAsset != null) {
              const serviceWorkerContents = serviceWorkerAsset.source().toString();
              const modifiedServiceWorkerContents =
                serviceWorkerContents + '\n' + clientReloaderScriptContent;

              compilation.updateAsset(
                serviceWorkerName,
                new webpack.sources.RawSource(modifiedServiceWorkerContents)
              );
            }

            const defaultPopupHtmlName = manifest.action?.default_popup;
            const defaultPopupHtmlAsset = compilation.assets[defaultPopupHtmlName];

            if (defaultPopupHtmlAsset != null) {
              if (defaultPopupHtmlAsset != null) {
                const defaultPopupHtmlContents = defaultPopupHtmlAsset.source().toString();
                const modifiedDefaultPopupHtmlContents = defaultPopupHtmlContents.replace(
                  '</body>',
                  `<script>
                      ${clientReloaderScriptContent}
                  </script>
                  </body>`
                );

                compilation.updateAsset(
                  defaultPopupHtmlName,
                  new webpack.sources.RawSource(modifiedDefaultPopupHtmlContents)
                );
              }
            }

            const optionsHtmlName = manifest.options_page || manifest.options_ui?.page;
            const optionsHtmlAsset = compilation.assets[optionsHtmlName];

            if (optionsHtmlAsset != null) {
              if (optionsHtmlAsset != null) {
                const optionsHtmlContents = optionsHtmlAsset.source().toString();
                const modifiedOptionsHtmlContents = optionsHtmlContents.replace(
                  '</body>',
                  `<script>
                     ${clientReloaderScriptContent}
                  </script>
                  </body>`
                );

                compilation.updateAsset(
                  optionsHtmlName,
                  new webpack.sources.RawSource(modifiedOptionsHtmlContents)
                );
              }
            }
          }
        }
      );
    });

    compiler.hooks.done.tapAsync(this.name, async (stats, done) => {
      if (Object.keys(stats.compilation.assets).length > 0) {
        this._log.verbose(`Build complete. Scheduling reload...`);
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
    return Array.from(this._wss.clients).some((client) => {
      if (client.readyState === WebSocket.OPEN) {
        return true;
      }

      return false;
    });
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
    this._log.info('Reloading extension...');

    this._wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        this._log.verbose(`Reloading client: ${client.url}`);
        client.send('reload');
      }
    });
  }

  private async launchBrowser() {
    try {
      this._log.info('Launching Chrome...');
      const chromePath = resolveChromeExecutablePath();

      if (chromePath == null) {
        throw new Error('Chrome not found');
      }

      const browser = spawn(
        chromePath,
        [
          `--load-extension=${this._extensionPath}`,
          '--no-first-run',
          '--no-default-browser-check',
          this._options.openBrowserPage
            ? `chrome-extension://${this._extensionId}/${this._options.openBrowserPage}`
            : null,
        ].filter(Boolean) as string[],
        { detached: true, stdio: 'ignore' }
      );

      browser.unref();
    } catch (e) {
      this._log.error(`Failed to launch browser: ${e.message}`);
    }
  }

  private writePluginExtensionMetadata() {
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
