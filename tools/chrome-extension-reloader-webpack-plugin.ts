import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import { apps, openApp } from 'open';
import path from 'path';
import { text } from 'stream/consumers';
import webpack from 'webpack';
import WebSocket from 'ws';

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
  extensionDir: string;
  backgroundScriptEntryId: string;
  remoteDebugPort?: number;
  launch?: boolean;
  timeoutMs?: number;
  verbose?: boolean;
}

const createLogger = (options: { prefix: string; verbose?: boolean }) => {
  const colors = webpack.cli.createColors();

  const createPrefix = (level: string, color: (text: string) => string) =>
    colors.bold(color(level));

  return {
    info: (message: string) => {
      console.info(`${createPrefix('INFO', colors.green)} ${colors.greenBright(message)}`);
    },
    warn: (message: string) => {
      console.warn(`${createPrefix('WARN', colors.yellow)} ${colors.yellowBright(message)}`);
    },
    error: (message: string) => {
      console.error(`${createPrefix('ERROR', colors.red)} ${colors.redBright(message)}`);
    },
    verbose: (message: string) => {
      if (!options.verbose) {
        return;
      }

      console.info(
        `${createPrefix('VERBOSE', colors.gray)} ${colors.gray(colors.italic(message))}`
      );
    },
  };
};

export class ChromeExtensionReloaderWebpackPlugin implements webpack.WebpackPluginInstance {
  private readonly name = 'ChromeExtensionReloaderWebpackPlugin';

  private _options: ChromeExtensionReloaderPluginOptions;

  private _extensionId: string;
  private _manifestKey: string;

  private _sockets: { extension: WebSocket; activeTab: WebSocket } = {
    extension: null,
    activeTab: null,
  };
  private _log: ReturnType<typeof createLogger>;

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = this.normalizeOptions(options);
    this._log = createLogger({ prefix: this.name, verbose: this._options.verbose });
  }

  private normalizeOptions(options: ChromeExtensionReloaderPluginOptions) {
    return {
      backgroundScriptEntryId: options.backgroundScriptEntryId,
      extensionDir: options.extensionDir,
      remoteDebugPort: options.remoteDebugPort ?? 9222,
      launch: options.launch ?? false,
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
    compiler.hooks.initialize.tap(this.name, () => {
      this._log.verbose(`Initialized.`);
      this.generateCertificate();
    });

    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (assets) => {
          const manifestAsset = assets['manifest.json'];
          if (manifestAsset) {
            const content = manifestAsset.source().toString();
            const manifest = JSON.parse(content);
            manifest.key = this._manifestKey;
            const newContent = JSON.stringify(manifest, null, 2);
            compilation.updateAsset('manifest.json', new webpack.sources.RawSource(newContent));
            this._log.info(`Injected key into manifest.json. Extension ID: ${this._extensionId}`);
          }
        }
      );
    });

    compiler.hooks.done.tapAsync(this.name, async (stats, done) => {
      const changedAssets = Object.keys(stats.compilation.assets);

      if (changedAssets.length > 0) {
        this._log.verbose(`Reloading extension...`);

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

  private generateCertificate() {
    const keyPath = path.join(this._options.extensionDir, 'key.pem');

    if (fs.existsSync(keyPath)) {
      try {
        const privateKeyPem = fs.readFileSync(keyPath, 'utf8');
        const keyObject = crypto.createPrivateKey(privateKeyPem);
        const publicKeyObject = crypto.createPublicKey(keyObject);
        const publicKeyDer = publicKeyObject.export({ type: 'spki', format: 'der' });
        this._manifestKey = publicKeyDer.toString('base64');
        this._extensionId = this.calculateExtensionId(publicKeyDer);
        this._log.info(`Loaded existing key. Extension ID: ${this._extensionId}`);
        return;
      } catch (e) {
        this._log.warn(`Failed to load existing key: ${e.message}. Generating new one.`);
      }
    }

    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    this._manifestKey = keyPair.publicKey.toString('base64');
    this._extensionId = this.calculateExtensionId(keyPair.publicKey);
    this._log.info(`Generated new key. Extension ID: ${this._extensionId}`);
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

  /**
   * Main extension workflow.
   */
  private async reload(): Promise<void> {
    if (this._options.launch && !this.isBrowserOpen()) {
      this._log.info('Launching Chrome with remote debugging enabled...');
      await this.launchChromeWithRemoteDebugging();
    }

    const targets = await this.fetchBrowserDevToolsTargets();
    this._log.verbose(`Retrieved ${targets.length} devtools targets.`);

    const extensionTarget = this.resolveDevToolsExtensionTarget(targets);

    if (extensionTarget == null) {
      this._log.error(`The devtools target for the extension could not be found.`);
      return;
    }

    this._log.verbose(`Resolved extension target:`);
    this._log.verbose(JSON.stringify(extensionTarget, null, 2));

    if (
      this._sockets.extension == null ||
      this.getSocketConnectionStatus(this._sockets.extension) === 'unavailable'
    ) {
      await this.connectWebSocket('extension', extensionTarget.webSocketDebuggerUrl);
      this._log.verbose(`Connected to extension.`);
    }

    this._log.info(`Reloading extension...`);
    await this.executeExtensionReload();

    const activeTabTarget = this.resolveDevToolsActiveTabTarget(targets);

    if (activeTabTarget != null) {
      if (
        this._sockets.activeTab == null ||
        this.getSocketConnectionStatus(this._sockets.activeTab) === 'unavailable'
      ) {
        await this.connectWebSocket('activeTab', activeTabTarget.webSocketDebuggerUrl);
        this._log.verbose(`Connected to active tab.`);
      }

      this._log.info(`Reloading active tab...`);
      await this.executeBrowserActiveTabReload();
    }

    this._log.info(`Reload finished.`);
  }

  private async launchChromeWithRemoteDebugging() {
    return openApp(apps.browser, {
      arguments: [
        `--remote-debugging-port=${this._options.remoteDebugPort}`,
        `--user-data-dir="${path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'RemoteDebuggingProfile')}"`,
      ],
    });
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
        try {
          const output = execSync(
            `curl -s ${this.getDevtoolsTargetsUrl('/json/list')}`,
            { stdio: ['ignore', 'pipe', 'ignore'] } // ignore curl errors
          ).toString();

          resolve(JSON.parse(output));
        } catch (err) {
          reject(new Error(`Failed to fetch Chrome browser devtools targets: ${err.message}.`));
        }
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

      socket.once('message', () => {
        resolve();
      });

      socket.on('error', reject);

      socket.send(JSON.stringify({ id: 1, ...command }));
    });
  }

  private isBrowserOpen(): boolean {
    try {
      const output = execSync(
        `curl -s ${this.getDevtoolsTargetsUrl('/json/version')}`,
        { stdio: ['ignore', 'pipe', 'ignore'] } // ignore curl errors
      ).toString();

      const json = JSON.parse(output);

      return typeof json?.Browser === 'string';
    } catch {
      return false;
    }
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
