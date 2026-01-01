import { Userscript, GlobalModule, EditorSettings, GlobalModules, Userscripts } from './model';

export class StorageManager {
  private static readonly SettingsDefaults: EditorSettings = {
    theme: 'vs-dark',
    fontSize: 14,
    tabSize: 2,
    autoFormat: true,
    autoSave: true,
  };

  static async getScripts(): Promise<Userscripts> {
    return chrome.storage.sync.get(['userscripts']) ?? {};
  }

  static async saveScript(script: Userscript): Promise<void> {
    const scripts = await this.getScripts();

    if (scripts[script.id] == null) {
      scripts[script.id] = script;
    } else {
      scripts[script.id] = script;
    }

    await chrome.storage.sync.set({ userscripts: scripts });
  }

  static async deleteScript(scriptId: string): Promise<void> {
    const scripts = await this.getScripts();
    console.log('Current scripts: ', scripts);
    delete scripts[scriptId];
    console.log('Updated scripts: ', scripts);

    await chrome.storage.sync.set({ userscripts: scripts });
  }

  static async getModules(): Promise<GlobalModules> {
    return chrome.storage.sync.get(['globalModules']);
  }

  static async saveModule(module: GlobalModule): Promise<void> {
    const modules = await this.getModules();

    modules[module.id] = module;

    await chrome.storage.sync.set({ globalModules: modules });
  }

  static async deleteModule(moduleId: string): Promise<void> {
    const modules = await this.getModules();

    delete modules[moduleId];

    await chrome.storage.sync.set({ globalModules: modules });
  }

  static async getEditorSettings(): Promise<EditorSettings> {
    const data = await chrome.storage.sync.get(['editorSettings']);
    return { ...this.SettingsDefaults, ...data };
  }

  static async saveEditorSettings(editorSettings: Partial<EditorSettings>): Promise<void> {
    await chrome.storage.sync.set({ editorSettings });
  }
}
