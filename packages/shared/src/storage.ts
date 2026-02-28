import { Userscript, GlobalModule, EditorSettings, GlobalModules, Userscripts } from "./model";

export const defaultSettings: EditorSettings = {
  theme: "invert-dark",
  fontSize: 14,
  tabSize: 2,
  autoFormat: true,
  autoSave: true,
};

export class StorageManager {
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
    const allScripts = await this.getAllScripts();

    const script = allScripts[id];

    if (!script) {
      throw new Error(`Userscript not found: ${id}`);
    }

    const updatedScript = { ...script, ...updates };
    allScripts[id] = updatedScript;

    console.log("StorageManager: Saving updated script:", {
      id,
      typescript: updatedScript.code?.source?.typescript?.substring(0, 100),
      scss: updatedScript.code?.source?.scss?.substring(0, 100),
    });

    await chrome.storage.sync.set({ userscripts: allScripts });
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
    return { ...defaultSettings, ...result.editorSettings };
  }

  static async saveEditorSettings(editorSettings: Partial<EditorSettings>): Promise<void> {
    const current = await this.getEditorSettings();
    await chrome.storage.sync.set({ editorSettings: { ...current, ...editorSettings } });
  }
}
