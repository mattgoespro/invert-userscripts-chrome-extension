import { UserScript, ScriptFile, GlobalModule, AppSettings } from './model';

const StorageKeys = {
  scripts: 'userscripts',
  scriptFiles: 'scriptFiles',
  modules: 'globalModules',
  settings: 'appSettings',
};

export class IDEStorageManager {
  static async getScripts(): Promise<UserScript[]> {
    const result: Record<string, UserScript[]> = await chrome.storage.sync.get(StorageKeys.scripts);
    return result[StorageKeys.scripts] || [];
  }

  static async saveScript(script: UserScript): Promise<void> {
    const scripts = await this.getScripts();
    const index = scripts.findIndex((s) => s.id === script.id);

    if (index >= 0) {
      scripts[index] = script;
    } else {
      scripts.push(script);
    }

    await chrome.storage.sync.set({ [StorageKeys.scripts]: scripts });
  }

  static async deleteScript(scriptId: string): Promise<void> {
    const scripts = await this.getScripts();
    const filtered = scripts.filter((s) => s.id !== scriptId);
    await chrome.storage.sync.set({ [StorageKeys.scripts]: filtered });

    // Also delete associated files
    const files = await this.getScriptFiles(scriptId);
    for (const file of files) {
      await this.deleteScriptFile(file.id);
    }
  }

  // Script Files
  static async getScriptFiles(scriptId: string): Promise<ScriptFile[]> {
    const result: Record<string, ScriptFile[]> = await chrome.storage.sync.get(
      StorageKeys.scriptFiles
    );
    const allFiles: ScriptFile[] = result[StorageKeys.scriptFiles] || [];
    return allFiles.filter((f) => f.scriptId === scriptId);
  }

  static async saveScriptFile(file: ScriptFile): Promise<void> {
    const result: Record<string, ScriptFile[]> = await chrome.storage.sync.get(
      StorageKeys.scriptFiles
    );
    const files: ScriptFile[] = result[StorageKeys.scriptFiles] || [];
    const index = files.findIndex((f) => f.id === file.id);

    if (index >= 0) {
      files[index] = file;
    } else {
      files.push(file);
    }

    await chrome.storage.sync.set({ [StorageKeys.scriptFiles]: files });
  }

  static async deleteScriptFile(fileId: string): Promise<void> {
    const result: Record<string, ScriptFile[]> = await chrome.storage.sync.get(
      StorageKeys.scriptFiles
    );
    const files: ScriptFile[] = result[StorageKeys.scriptFiles] || [];
    const filtered = files.filter((f) => f.id !== fileId);
    await chrome.storage.sync.set({ [StorageKeys.scriptFiles]: filtered });
  }

  // Global Modules
  static async getModules(): Promise<GlobalModule[]> {
    const result: Record<string, GlobalModule[]> = await chrome.storage.sync.get(
      StorageKeys.modules
    );
    return result[StorageKeys.modules] || [];
  }

  static async saveModule(module: GlobalModule): Promise<void> {
    const modules = await this.getModules();
    const index = modules.findIndex((m) => m.id === module.id);

    if (index >= 0) {
      modules[index] = module;
    } else {
      modules.push(module);
    }

    await chrome.storage.sync.set({ [StorageKeys.modules]: modules });
  }

  static async deleteModule(moduleId: string): Promise<void> {
    const modules = await this.getModules();
    const filtered = modules.filter((m) => m.id !== moduleId);
    await chrome.storage.sync.set({ [StorageKeys.modules]: filtered });
  }

  private static readonly SettingsDefault = {
    editorTheme: 'vs-dark',
    fontSize: 14,
    tabSize: 2,
    autoFormat: true,
    autoSave: true,
  };

  // Settings
  static async getSettings(): Promise<AppSettings> {
    const result: Record<string, AppSettings> = await chrome.storage.sync.get(StorageKeys.settings);
    return result[StorageKeys.settings] || IDEStorageManager.SettingsDefault;
  }

  static async saveSettings(settings: AppSettings): Promise<void> {
    await chrome.storage.sync.set({ [StorageKeys.settings]: settings });
  }
}
