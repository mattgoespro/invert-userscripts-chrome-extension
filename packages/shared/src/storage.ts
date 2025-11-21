import { UserScript, ScriptFile, GlobalModule, AppSettings } from './model';

const STORAGE_KEYS = {
  SCRIPTS: 'userscripts',
  SCRIPT_FILES: 'scriptFiles',
  MODULES: 'globalModules',
  SETTINGS: 'appSettings',
};

export class IDEStorageManager {
  static async getScripts(): Promise<UserScript[]> {
    const result: Record<string, UserScript[]> = await chrome.storage.sync.get(
      STORAGE_KEYS.SCRIPTS
    );
    return result[STORAGE_KEYS.SCRIPTS] || [];
  }

  static async saveScript(script: UserScript): Promise<void> {
    const scripts = await this.getScripts();
    const index = scripts.findIndex((s) => s.id === script.id);

    if (index >= 0) {
      scripts[index] = script;
    } else {
      scripts.push(script);
    }

    await chrome.storage.sync.set({ [STORAGE_KEYS.SCRIPTS]: scripts });
  }

  static async deleteScript(scriptId: string): Promise<void> {
    const scripts = await this.getScripts();
    const filtered = scripts.filter((s) => s.id !== scriptId);
    await chrome.storage.sync.set({ [STORAGE_KEYS.SCRIPTS]: filtered });

    // Also delete associated files
    const files = await this.getScriptFiles(scriptId);
    for (const file of files) {
      await this.deleteScriptFile(file.id);
    }
  }

  // Script Files
  static async getScriptFiles(scriptId: string): Promise<ScriptFile[]> {
    const result: Record<string, ScriptFile[]> = await chrome.storage.sync.get(
      STORAGE_KEYS.SCRIPT_FILES
    );
    const allFiles: ScriptFile[] = result[STORAGE_KEYS.SCRIPT_FILES] || [];
    return allFiles.filter((f) => f.scriptId === scriptId);
  }

  static async saveScriptFile(file: ScriptFile): Promise<void> {
    const result: Record<string, ScriptFile[]> = await chrome.storage.sync.get(
      STORAGE_KEYS.SCRIPT_FILES
    );
    const files: ScriptFile[] = result[STORAGE_KEYS.SCRIPT_FILES] || [];
    const index = files.findIndex((f) => f.id === file.id);

    if (index >= 0) {
      files[index] = file;
    } else {
      files.push(file);
    }

    await chrome.storage.sync.set({ [STORAGE_KEYS.SCRIPT_FILES]: files });
  }

  static async deleteScriptFile(fileId: string): Promise<void> {
    const result: Record<string, ScriptFile[]> = await chrome.storage.sync.get(
      STORAGE_KEYS.SCRIPT_FILES
    );
    const files: ScriptFile[] = result[STORAGE_KEYS.SCRIPT_FILES] || [];
    const filtered = files.filter((f) => f.id !== fileId);
    await chrome.storage.sync.set({ [STORAGE_KEYS.SCRIPT_FILES]: filtered });
  }

  // Global Modules
  static async getModules(): Promise<GlobalModule[]> {
    const result: Record<string, GlobalModule[]> = await chrome.storage.sync.get(
      STORAGE_KEYS.MODULES
    );
    return result[STORAGE_KEYS.MODULES] || [];
  }

  static async saveModule(module: GlobalModule): Promise<void> {
    const modules = await this.getModules();
    const index = modules.findIndex((m) => m.id === module.id);

    if (index >= 0) {
      modules[index] = module;
    } else {
      modules.push(module);
    }

    await chrome.storage.sync.set({ [STORAGE_KEYS.MODULES]: modules });
  }

  static async deleteModule(moduleId: string): Promise<void> {
    const modules = await this.getModules();
    const filtered = modules.filter((m) => m.id !== moduleId);
    await chrome.storage.sync.set({ [STORAGE_KEYS.MODULES]: filtered });
  }

  // Settings
  static async getSettings(): Promise<AppSettings> {
    const result: Record<string, AppSettings> = await chrome.storage.sync.get(
      STORAGE_KEYS.SETTINGS
    );
    return (
      result[STORAGE_KEYS.SETTINGS] || {
        editorTheme: 'vs-dark',
        fontSize: 14,
        tabSize: 2,
        autoFormat: true,
        autoSave: true,
        enableTypeChecking: true,
      }
    );
  }

  static async saveSettings(settings: AppSettings): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
  }
}
