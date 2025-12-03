import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import webpack from 'webpack';
import WebSocket from 'ws';
import type { Logger } from './utils.ts';
import { createLogger, launchChromeWithRemoteDebugging } from './utils.ts';

export interface DevToolsTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export interface DevToolsCommand {
  method: string;
  params?: Record<string, any>;
}

export interface ChromeExtensionReloaderPluginOptions {
  remoteDebugPort?: number;
  launchBrowser?: boolean;
  timeoutMs?: number;
  verbose?: boolean;
}

export class ChromeExtensionReloaderWebpackPlugin implements webpack.WebpackPluginInstance {
  private readonly name = 'ChromeExtensionReloaderWebpackPlugin';
  private readonly dataDir = path.join(process.env.LOCALAPPDATA || '', 'ChromeExtensionReloader');

  private _options: ChromeExtensionReloaderPluginOptions;

  private _extensionId: string;
  private _manifestKey: string;

  private _sockets: { extension: WebSocket; activeTab: WebSocket } = {
    extension: null,
    activeTab: null,
  };
  private _log: Logger;

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = this.normalizeOptions(options);
    this._log = createLogger(this.name, { prefix: this.name, verbose: this._options.verbose });
    fs.ensureDirSync(this.dataDir);
  }

  get manifestKey(): string {
    return this._manifestKey;
  }

  private normalizeOptions(
    options: ChromeExtensionReloaderPluginOptions
  ): ChromeExtensionReloaderPluginOptions {
    return {
      remoteDebugPort: options.remoteDebugPort ?? 9222,
      launchBrowser: options.launchBrowser ?? false,
      timeoutMs: options.timeoutMs ?? 30000,
      verbose: options.verbose ?? false,
    };
  }

  /**
   * Apply the extension reloader plugin to the Webpack compiler so that it integrates into the webpack build lifecycle.
   *
   * @param compiler The Webpack compiler instance.
   */
  async apply(compiler: webpack.Compiler) {
    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (assets) => {
          const manifestAsset = assets['manifest.json'];

          if (manifestAsset == null) {
            return;
          }

          const manifest = JSON.parse(manifestAsset.source().toString());
          console.log(manifest.key);
          manifest.key = this._manifestKey;
          compilation.updateAsset(
            'manifest.json',
            new webpack.sources.RawSource(JSON.stringify(manifest, null, 2))
          );

          this._log.verbose(`Injected key into extension manifest.`);
        }
      );
    });

    compiler.hooks.done.tapAsync(this.name, async (stats, done) => {
      if (Object.keys(stats.compilation.assets).length > 0) {
        try {
          await this.reload();
          this._log.info(`Reload finished.`);
        } catch (error) {
          this._log.error(`Reload failed: ${error.message}`);
        }
      }

      done();
    });

    compiler.hooks.shutdown.tap(this.name, () => {
      this.disconnect();
    });

    compiler.hooks.watchClose.tap(this.name, () => {
      this.disconnect();
    });
  }

  /**
   * Main extension workflow.
   */
  private async reload(): Promise<void> {
    const isBrowserOpen = await this.isBrowserOpen();
    this._log.verbose(`Browser is open: ${isBrowserOpen}`);

    if (this._options.launchBrowser && !isBrowserOpen) {
      this._log.info('Launching Chrome with remote debugging enabled...');
      await launchChromeWithRemoteDebugging(this._options.remoteDebugPort);
      await this.waitForBrowser();
    }

    const targets = await this.fetchBrowserDevToolsTargets();
    this._log.verbose(`Retrieved ${targets.length} devtools targets.`);

    const extensionTarget = this.resolveDevToolsExtensionTarget(targets);

    if (extensionTarget == null) {
      throw new Error(`The devtools target for the extension could not be found.`);
    }

    this._log.verbose(`Resolved extension target:`);
    this._log.verbose(extensionTarget);

    if (
      this._sockets.extension == null ||
      this.getSocketConnectionStatus(this._sockets.extension) === 'unavailable'
    ) {
      await this.connectWebSocket('extension', extensionTarget.webSocketDebuggerUrl);
      this._log.verbose(`Connected to extension.`);
    }

    this._log.info(`Reloading extension target...`);

    await this.executeExtensionReload();

    const activeTabTarget = this.resolveDevToolsActiveTabTarget(targets);

    if (activeTabTarget != null) {
      this._log.verbose(`Resolved active tab target:`);
      this._log.verbose(activeTabTarget);

      if (
        this._sockets.activeTab == null ||
        this.getSocketConnectionStatus(this._sockets.activeTab) === 'unavailable'
      ) {
        await this.connectWebSocket('activeTab', activeTabTarget.webSocketDebuggerUrl);
        this._log.verbose(`Connected to active tab.`);
      }

      this._log.info(`Reloading active tab target...`);
      await this.executeBrowserActiveTabReload();
    }
  }

  private disconnect() {
    if (this._sockets.extension != null) {
      this._sockets.extension.close();
      this._sockets.extension = null;
      this._log.verbose(`Extension websocket connection closed.`);
    }

    if (this._sockets.activeTab != null) {
      this._sockets.activeTab.close();
      this._sockets.activeTab = null;
      this._log.verbose(`Active tab websocket connection closed.`);
    }
  }

  private generateManifestCertificate() {
    const keyPath = path.join(this.dataDir, 'key.pem');

    if (fs.existsSync(keyPath)) {
      try {
        const privateKeyPem = fs.readFileSync(keyPath, 'utf8');
        const keyObject = crypto.createPrivateKey(privateKeyPem);
        const publicKeyObject = crypto.createPublicKey(keyObject);
        const publicKeyDer = publicKeyObject.export({ type: 'spki', format: 'der' });

        this._manifestKey = publicKeyDer.toString('base64');
        this._extensionId = this.calculateExtensionId(publicKeyDer);

        this._log.verbose(`Calculated Extension ID: ${this._extensionId}`);
        return;
      } catch (error) {
        this._log.warn(
          `Failed to load existing manifest key: ${error.message}. Generating new one...`
        );
      }
    }

    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    fs.writeFileSync(keyPath, keyPair.privateKey);

    this._manifestKey = keyPair.publicKey.toString('base64');
    this._extensionId = this.calculateExtensionId(keyPair.publicKey);

    this._log.verbose(`Generated new manifest key.`);
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

  private async connectWebSocket(socketName: keyof typeof this._sockets, debuggerUrl: string) {
    this._sockets[socketName] = new WebSocket(debuggerUrl);

    await Promise.race([
      new Promise<void>((resolve, reject) => {
        this._sockets[socketName]
          .once('open', () => {
            this._log.verbose(`Connected to websocket '${socketName}'.`);
            resolve();
          })
          .once('error', (error) => {
            this._log.error(`Error connecting to websocket '${socketName}': ${error.message}`);
            reject(new Error(`Error connecting to websocket '${socketName}': ${error.message}`));
          });
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => {
          reject(
            new Error(
              `Timed out connecting to websocket '${socketName}' after ${this._options.timeoutMs}ms.`
            )
          );
          this._log.error(
            `Timed out connecting to websocket '${socketName}' after ${this._options.timeoutMs}ms.`
          );
        }, this._options.timeoutMs)
      ),
    ]);
  }

  private async fetchBrowserDevToolsTargets() {
    return Promise.race([
      new Promise<DevToolsTarget[]>((resolve, reject) => {
        fetch(this.getDevtoolsTargetsUrl('/json'))
          .then((response) => {
            if (!response.ok) {
              throw new Error(
                `Failed to fetch devtools targets: ${response.status} ${response.statusText}`
              );
            }
            return response.json();
          })
          .then((data: DevToolsTarget[]) => {
            resolve(data);
          })
          .catch((error) => {
            this._log.error(`Error fetching devtools targets: ${error.message}`);
            reject(new Error(`Error fetching devtools targets: ${error.message}`));
          });
      }),
      new Promise<DevToolsTarget[]>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`Timed out fetching devtools targets after ${this._options.timeoutMs}ms.`)
            ),
          this._options.timeoutMs
        )
      ),
    ]);
  }

  private waitForBrowser(): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkBrowser = () => {
        if (this.isBrowserOpen()) {
          resolve();
        } else if (Date.now() - startTime > this._options.timeoutMs) {
          reject(
            new Error(`Timed out waiting for browser to open after ${this._options.timeoutMs}ms.`)
          );
        } else {
          setTimeout(checkBrowser, 500);
        }
      };

      checkBrowser();
    });
  }

  private resolveDevToolsExtensionTarget(targets: DevToolsTarget[]) {
    return targets.find(
      (t) =>
        t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${this._extensionId}`)
    );
  }

  private resolveDevToolsActiveTabTarget(targets: DevToolsTarget[]) {
    return (
      targets.find(
        (target) => target.type === 'page' && !target.url.startsWith('chrome-extension://')
      ) ?? null
    );
  }

  private executeExtensionReload(): Promise<void> {
    return this.executeBrowserDevToolsCommand(this._sockets.extension, {
      method: 'Runtime.evaluate',
      params: { expression: 'chrome.runtime.reload()' },
    });
  }

  private executeBrowserActiveTabReload(): Promise<void> {
    return this.executeBrowserDevToolsCommand(this._sockets.activeTab, {
      method: 'Page.reload',
      params: { ignoreCache: true },
    });
  }

  private executeBrowserDevToolsCommand(
    socket: WebSocket,
    command: DevToolsCommand
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (socket == null || this.getSocketConnectionStatus(socket) === 'unavailable') {
        return reject(new Error('Failed to execute command: socket is unavailable.'));
      }

      socket
        .once('message', () => {
          resolve();
        })
        .on('error', reject)
        .send(JSON.stringify({ id: 1, ...command }));
    });
  }

  private async isBrowserOpen(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      fetch(this.getDevtoolsTargetsUrl('/json'))
        .then((response) => {
          if (!response.ok) {
            return resolve(false);
          }

          resolve(response.ok);
        })
        .catch(() => {
          resolve(false);
        });
    });
  }

  private getDevtoolsTargetsUrl(path: string): string {
    return `http://localhost:${this._options.remoteDebugPort}${path}`;
  }

  private getSocketConnectionStatus(socket: WebSocket): string {
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'unavailable';
      default:
        throw new Error(`${socket.url} - Unknown WebSocket state: ${socket.readyState}`);
    }
  }
}
