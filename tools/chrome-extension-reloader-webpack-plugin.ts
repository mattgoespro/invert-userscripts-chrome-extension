import { ChildProcess, spawn } from 'child_process';
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
  private _browser: ChildProcess = null;

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = this.normalizeOptions(options);
    this._log = createLogger(this.name, { prefix: this.name, verbose: this._options.verbose });

    this.writePluginExtensionMetadata();
    this.startServer();
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

  private startServer() {
    if (this._wss) return;

    this._wss = new WebSocketServer({ port: this._options.port });

    this._wss.on('connection', (ws) => {
      this._log.verbose('Client connected');
      ws.on('close', () => this._log.verbose('Client disconnected'));
      ws.on('error', (err) => this._log.error(`Client error: ${err.message}`));
    });

    this._wss.on('listening', () => {
      this._log.info(`Reload server listening on port ${this._options.port}`);
    });

    this._wss.on('error', (err) => {
      this._log.error(`WebSocket server error: ${err.message}`);
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

          if (asset != null) {
            const source = asset.source().toString();
            const manifest = JSON.parse(source);
            manifest.key = this._manifestKey;
            const newSource = JSON.stringify(manifest, null, 2);

            compilation.updateAsset(manifestName, new webpack.sources.RawSource(newSource));
          }

          const backgroundName = 'background.js';
          const backgroundAsset = compilation.assets[backgroundName];

          if (backgroundAsset != null) {
            const source = backgroundAsset.source().toString();
            const clientScript = this.getClientScript();
            const newSource = source + '\n' + clientScript;

            compilation.updateAsset(backgroundName, new webpack.sources.RawSource(newSource));
          }
        }
      );
    });

    compiler.hooks.done.tapAsync(this.name, async (stats, done) => {
      if (Object.keys(stats.compilation.assets).length > 0) {
        this._log.verbose(`Build complete. Scheduling reload...`);
        this.scheduleReload();
      }

      // launch the browser only if configured to auto-launch and the browser is not already running
      if (this._options.autoLaunchBrowser && this._browser == null) {
        this.launchBrowser();
      }

      done();
    });

    compiler.hooks.shutdown.tap(this.name, async () => {
      if (this._wss) {
        this._wss.close();
        this._log.verbose('Server closed');
      }
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
    if (!this._wss) return;
    this._log.info('Broadcasting reload signal...');
    this._wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
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

      this._browser = spawn(
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
      ).on('close', (code) => {
        this._log.verbose(`Chrome process exited with code ${code}`);
        this._browser = null;
      });
      this._browser.unref();
    } catch (e) {
      this._log.error(`Failed to launch browser: ${e.message}`);
    }
  }

  private getClientScript(): string {
    return `
      (function() {
        let ws;
        let retryInterval;

        function connect() {
            if (ws) return;
            ws = new WebSocket('ws://localhost:${this._options.port}');

            ws.onopen = () => {
                console.log('[Vertex IDE Reloader] Connected to build server');
                if (retryInterval) {
                    clearInterval(retryInterval);
                    retryInterval = null;
                }
            };

            ws.onmessage = (event) => {
                if (event.data === 'reload') {
                    console.log('[Vertex IDE Reloader] Reloading extension...');
                    chrome.runtime.reload();
                }
            };

            ws.onclose = () => {
                ws = null;
                console.log('[Vertex IDE Reloader] Disconnected. Retrying in 1s...');
                if (!retryInterval) {
                    retryInterval = setInterval(connect, 1000);
                }
            };

            ws.onerror = (err) => {
                console.error('[Vertex IDE Reloader] WebSocket error:', err);
                ws.close(); // Ensure close is called to trigger retry
            };
        }

        connect();

        // Keep-alive for service worker
        setInterval(() => {
            chrome.runtime.getPlatformInfo(() => {});
        }, 20000);
      })();
      `;
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
