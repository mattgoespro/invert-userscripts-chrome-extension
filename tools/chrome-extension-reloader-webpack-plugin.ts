import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import webpack from 'webpack';
import type { Logger } from './utils.ts';
import { createLogger, resolveChromeExecutablePath } from './utils.ts';
import CDP from 'chrome-remote-interface';

export interface DevToolsCommand {
  method: string;
  params?: Record<string, any>;
}

export interface ChromeExtensionReloaderPluginOptions {
  remoteDebugPort?: number;
  launchBrowser?: boolean;
  openBrowserPage?: string;
  timeoutMs?: number;
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
  private _extensionClient: CDP.Client = null;
  private _activeTabClient: CDP.Client = null;
  private _reloader: NodeJS.Timeout = null;

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = this.normalizeOptions(options);
    this._log = createLogger(this.name, { prefix: this.name, verbose: this._options.verbose });

    this.setExtensionId();
  }

  private normalizeOptions(
    options: ChromeExtensionReloaderPluginOptions
  ): ChromeExtensionReloaderPluginOptions {
    return {
      remoteDebugPort: options.remoteDebugPort ?? 9222,
      launchBrowser: options.launchBrowser ?? false,
      openBrowserPage: options.openBrowserPage ?? 'options.html',
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
    this._extensionPath = compiler.options.output.path;

    compiler.hooks.emit.tap(this.name, (compilation) => {
      const manifestName = 'manifest.json';
      const asset = compilation.assets[manifestName];

      if (asset) {
        const source = asset.source().toString();
        const manifest = JSON.parse(source);
        manifest.key = this._manifestKey;
        const newSource = JSON.stringify(manifest, null, 2);

        compilation.updateAsset(manifestName, new webpack.sources.RawSource(newSource));
      }
    });

    compiler.hooks.done.tapAsync(this.name, async (stats, done) => {
      if (Object.keys(stats.compilation.assets).length > 0) {
        this._log.info(`Build completed. Scheduling extension reload...`);
        this.scheduleReload();
      }

      done();
    });

    compiler.hooks.shutdown.tap(this.name, () => {
      this.disconnect();
    });
  }

  private scheduleReload(): void {
    if (this._reloader != null) {
      this._log.verbose(`Clearing pending reload...`);
      clearTimeout(this._reloader);
    }

    this._reloader = setTimeout(async () => {
      try {
        await this.reload();
        this._log.info(`Reload complete.`);
      } catch (error) {
        console.error(error);
        this._log.warn(`Reload failed: ${error.message}`);
      } finally {
        this._reloader = null;
      }
    }, 1000);
  }

  /**
   * Main extension workflow.
   */
  private async reload(): Promise<void> {
    if (this._options.launchBrowser && !(await this.isBrowserOpen())) {
      this._log.info('Launching Chrome with remote debugging enabled...');
      await this.launchChromeWithRemoteDebugging();
    }

    if (this._extensionClient == null) {
      this._extensionClient = await this.createDebuggerProtocolClient((targets) =>
        targets.find((target) => target.url.startsWith(`chrome-extension://${this._extensionId}`))
      );
    }

    if (this._extensionClient == null) {
      this._log.warn(`Could not connect to extension runtime.`);
      return;
    }

    this._log.verbose(`Executing extension runtime reload...`);
    await this._extensionClient.Runtime.evaluate({ expression: 'chrome.runtime.reload()' });
    this._log.verbose(`Extension runtime reloaded.`);

    this._activeTabClient = await this.createDebuggerProtocolClient((targets) =>
      targets.find(
        (target) => target.type === 'page' && !target.url.startsWith('chrome-extension://')
      )
    );

    if (this._activeTabClient != null) {
      this._log.verbose(`Executing active tab reload...`);
      await this._activeTabClient.Page.reload({
        ignoreCache: true,
      });
      this._log.verbose(`Active tab reloaded.`);
    }
  }

  private createDebuggerProtocolClient(targetFilter: (targets: CDP.Target[]) => CDP.Target) {
    return new Promise<CDP.Client>((resolve) => {
      CDP({
        host: 'localhost',
        port: this._options.remoteDebugPort,
        target: targetFilter,
      })
        .then((client) => resolve(client as CDP.Client))
        .catch(() => resolve(null));
    });
  }

  private disconnect() {
    if (this._extensionClient != null) {
      this._extensionClient.close();
      this._extensionClient = null;
      this._log.verbose(`Extension runtime websocket connection closed.`);
    }

    if (this._activeTabClient != null) {
      this._activeTabClient.close();
      this._activeTabClient = null;
      this._log.verbose(`Active tab websocket connection closed.`);
    }
  }

  private setExtensionId() {
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

  private async launchChromeWithRemoteDebugging() {
    const userDataDir = path.join(this.cacheDir, 'remote-debugging-profile');
    const chromePath = resolveChromeExecutablePath();

    if (chromePath == null) {
      throw new Error('Could not find Chrome executable.');
    }

    const child = spawn(
      chromePath,
      [
        `--remote-debugging-port=${this._options.remoteDebugPort}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        `--load-extension=${this._extensionPath}`,
        `chrome-extension://${this._extensionId}/${this._options.openBrowserPage}`,
      ],
      {
        detached: true,
        stdio: 'ignore',
      }
    ).on('error', (err) => {
      this._log.error(`Failed to start Chrome: ${err.message}`);
    });

    child.unref();
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
}
