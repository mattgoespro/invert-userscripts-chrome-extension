import fs from 'fs-extra';
import path from 'path';
import webpack from 'webpack';
import WebSocket from 'ws';
import type {
  ChromeExtensionReloaderPluginOptions,
  DevToolsTarget,
  DevToolsCommand,
} from './webpack-extension-reloader.model.ts';
import { openApp, apps } from 'open';

export class ChromeExtensionReloaderPlugin implements webpack.WebpackPluginInstance {
  private readonly name = 'ChromeExtensionReloaderPlugin';

  private _options: ChromeExtensionReloaderPluginOptions;

  private _socket: WebSocket = null;
  private _extensionReloadTimer: NodeJS.Timeout = null;

  constructor(options: ChromeExtensionReloaderPluginOptions) {
    this._options = {
      remoteDebugPort: options.remoteDebugPort ?? 9222,
      manifestPath: options.manifestPath ?? path.join(options.extensionDir, 'manifest.json'),
      launch: options.launch ?? false,
      ...options,
    };

    if (this._options.launch) {
      openApp(apps.browser, {
        arguments: [`--remote-debugging-port=${this._options.remoteDebugPort}`],
      }).catch((err) => {
        console.error(`Failed to launch Chrome with remote debugging:`, err);
      });
    }
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.afterEmit.tapAsync(this.name, (compilation: any, done: () => void) => {
      const changedAssets = Object.keys(compilation.assets);

      if (changedAssets.length > 0) {
        console.log(`Files changed:`);
        changedAssets.forEach((asset) => console.log(` - ${asset}`));
        this.scheduleReload();
      }

      done();
    });
  }

  /**
   * Main workflow to reload the extension and active tab.
   */
  private async reload(): Promise<void> {
    const targets = await this.fetchBrowserDevToolsTargets();
    const extensionTarget = await this.findExtensionDevToolsTarget(targets);
    const extensionId = this.getTargetExtensionId(extensionTarget);
    const activeTab =
      targets.find(
        (target) => target.type === 'page' && !target.url.startsWith('chrome-extension://')
      ) ?? null;

    await this.reloadBrowserExtension(extensionTarget);

    if (activeTab != null) {
      await this.reloadBrowserTab(activeTab);
    }

    console.log(`Reload complete: "${extensionTarget.title}" (${extensionId})`);
  }

  private scheduleReload(): void {
    if (this._extensionReloadTimer != null) {
      clearTimeout(this._extensionReloadTimer);
    }

    this._extensionReloadTimer = setTimeout(() => {
      this.reload().catch((err) => console.error(`Reload failed:`, err));
    }, this._options.reloadDebounceMs);
  }

  private async fetchBrowserDevToolsTargets() {
    const url = `http://localhost:${this._options.remoteDebugPort}/json`;

    const rsp = await fetch(url, {
      method: 'GET',
      headers: { 'Access-Control-Allow-Origin': '*' },
    });

    if (!rsp.ok) {
      throw new Error(`Failed to fetch DevTools targets: ${rsp.status} ${rsp.statusText}`);
    }

    const targetsBody: DevToolsTarget[] = await rsp.json();
    console.log(`Fetched ${targetsBody.length} DevTools targets from Chrome.`);
    console.log(targetsBody);

    return targetsBody;
  }

  private async findExtensionDevToolsTarget(targets: DevToolsTarget[]) {
    const manifest = this.getExtensionManifest();
    const extensionName = manifest.name;

    if (extensionName == null) {
      throw new Error(`Could not read extension manifest file: "${this._options.manifestPath}"`);
    }

    const target = targets.find(
      (t) =>
        (t.type === 'background_page' || t.type === 'worker') && t.title.includes(extensionName)
    );

    if (target == null) {
      throw new Error(`Could not find Chrome target information for extension: ${extensionName}`);
    }

    return target;
  }

  private getTargetExtensionId(target: DevToolsTarget): string | null {
    const match = target.url.match(/chrome-extension:\/\/([^/]+)/);

    if (match == null) {
      throw new Error('Failed to find extension ID.');
    }

    return match[1];
  }

  private getExtensionManifest() {
    const manifestContent: chrome.runtime.Manifest = fs.readJsonSync(
      this._options.manifestPath || path.join(this._options.extensionDir, 'manifest.json'),
      { throws: false }
    );

    return manifestContent;
  }

  private reloadBrowserExtension(target: DevToolsTarget): Promise<void> {
    return this.sendBrowserDevToolsCommand(target.webSocketDebuggerUrl, {
      method: 'Runtime.evaluate',
      params: { expression: 'chrome.runtime.reload()' },
    });
  }

  private reloadBrowserTab(target: DevToolsTarget): Promise<void> {
    return this.sendBrowserDevToolsCommand(target.webSocketDebuggerUrl, {
      method: 'Page.reload',
      params: { ignoreCache: true },
    });
  }

  private sendBrowserDevToolsCommand(wsUrl: string, command: DevToolsCommand): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        ws.send(JSON.stringify({ id: 1, ...command }));
      });

      ws.on('message', () => {
        ws.close();
        resolve();
      });

      ws.on('error', reject);
    });
  }
}
