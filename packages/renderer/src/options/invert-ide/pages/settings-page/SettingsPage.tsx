import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { Input } from "@/shared/components/input/Input";
import { Typography } from "@/shared/components/typography/Typography";
import { EditorSettings } from "@shared/model";
import { StorageManager } from "@shared/storage";
import { useEffect, useState } from "react";
import "./SettingsPage.scss";

export function Settings() {
  const [settings, setSettings] = useState<EditorSettings>({
    theme: "vs-dark",
    fontSize: 14,
    tabSize: 2,
    autoFormat: true,
    autoSave: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      const storedSettings = await StorageManager.getEditorSettings();
      setSettings(storedSettings);
    };
    loadSettings();
  }, []);

  const handleUpdateSettings = async (updates: Partial<EditorSettings>) => {
    await StorageManager.saveEditorSettings(updates);
  };

  return (
    <div className="settings---content">
      <div className="settings---header">
        <Typography variant="subtitle">Settings</Typography>
      </div>
      <div className="settings--form">
        <label>Editor Theme</label>
        <select
          value={settings.theme}
          onChange={(e) => handleUpdateSettings({ theme: e.target.value })}
        >
          <option value="vs-dark">Dark</option>
          <option value="vs-light">Light</option>
          <option value="hc-black">High Contrast</option>
        </select>
        <Input
          type="number"
          label="Font size"
          value={settings.fontSize}
          onChange={(e) => handleUpdateSettings({ fontSize: parseInt(e.target.value) })}
          min="8"
          max="32"
        />
        <Input
          type="number"
          label="Tab size"
          value={settings.tabSize}
          onChange={(e) => handleUpdateSettings({ tabSize: parseInt(e.target.value) })}
          min="2"
          max="8"
        />

        <Checkbox
          label="Format on save"
          checked={settings.autoFormat}
          onChange={(checked) => handleUpdateSettings({ autoFormat: checked })}
        />
      </div>
    </div>
  );
}
