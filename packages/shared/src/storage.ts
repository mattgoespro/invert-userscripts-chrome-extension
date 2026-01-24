import { Userscript, GlobalModule, EditorSettings, GlobalModules, Userscripts } from "./model";

export class StorageManager {
  private static readonly SettingsDefaults: EditorSettings = {
    theme: "vs-dark",
    fontSize: 14,
    tabSize: 2,
    autoFormat: true,
    autoSave: true,
  };

  static async getAll(): Promise<{
    userscripts: Userscripts;
    globalModules: GlobalModules;
    editorSettings: EditorSettings;
  }> {
    return chrome.storage.sync.get();
  }

  static async getAllScripts(): Promise<Userscripts> {
    const result = await chrome.storage.sync.get<{ userscripts: Userscripts }>(["userscripts"]);
    return result.userscripts ?? {};
  }

  static async saveScript(script: Userscript): Promise<void> {
    const allScripts = await this.getAllScripts();
    await chrome.storage.sync.set({ userscripts: { ...allScripts, [script.id]: script } });
  }

  static async updateScript(id: string, updates: Partial<Omit<Userscript, "id">>): Promise<void> {
    await this.withLogging(`Update script ${id}`, async () => {
      const allScripts = await this.getAllScripts();

      const script = allScripts[id];

      if (!script) {
        throw new Error(`Userscript not found: ${script.name} (${id})`);
      }

      allScripts[id] = { ...script, ...updates };

      await chrome.storage.sync.set({ userscripts: allScripts });
    });
  }

  static async deleteScript(scriptId: string): Promise<void> {
    const allScripts = await this.getAllScripts();
    delete allScripts[scriptId];
    await chrome.storage.sync.set({ userscripts: allScripts });
  }

  static async getAllModules(): Promise<GlobalModules> {
    const result = await chrome.storage.sync.get<{ globalModules: GlobalModules }>([
      "globalModules",
    ]);
    return result.globalModules ?? {};
  }

  static async saveModule(module: GlobalModule): Promise<void> {
    const allModules = await this.getAllModules();

    allModules[module.id] = module;

    await chrome.storage.sync.set({ globalModules: allModules });
  }

  static async deleteModule(moduleId: string): Promise<void> {
    const allModules = await this.getAllModules();
    delete allModules[moduleId];
    await chrome.storage.sync.set({ globalModules: allModules });
  }

  static async getEditorSettings(): Promise<EditorSettings> {
    const result = await chrome.storage.sync.get<{ editorSettings: EditorSettings }>([
      "editorSettings",
    ]);
    return { ...this.SettingsDefaults, ...result.editorSettings };
  }

  static async saveEditorSettings(editorSettings: Partial<EditorSettings>): Promise<void> {
    const current = await this.getEditorSettings();
    await chrome.storage.sync.set({ editorSettings: { ...current, ...editorSettings } });
  }

  static async withLogging(operation: string, func: () => Promise<void>): Promise<void> {
    console.log(`StorageManager: Starting operation "${operation}"`);
    await func();
    console.log(`StorageManager: Completed operation "${operation}"`);
    console.log("StorageManager: State");
    console.log(await this.getAll());
  }
}
