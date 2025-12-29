import { AppSettings } from '@shared/model';
import './Settings.scss';
import { IDEStorageManager } from '@shared/storage';
import { Checkbox } from '@/shared/components/checkbox/Checkbox';
import { Typography } from '@/shared/components/typography/Typography';

type SettingsProps = {
  settings: AppSettings;
};

export function Settings({ settings }: SettingsProps) {
  const handleUpdateSettings = async (updates: Partial<AppSettings>) => {
    if (settings != null) {
      const updated = { ...settings, ...updates };
      await IDEStorageManager.saveSettings(updated);
    } else {
      const newSettings = { ...updates } as AppSettings;
      await IDEStorageManager.saveSettings(newSettings);
    }
  };

  return (
    <div className="settings--content">
      <div className="settings--header">
        <Typography variant="subtitle">Settings</Typography>
      </div>
      <div className="settings-form">
        <div className="setting-group">
          <label>Editor Theme</label>
          <select
            value={settings.editorTheme}
            onChange={(e) => handleUpdateSettings({ editorTheme: e.target.value })}
          >
            <option value="vs-dark">Dark</option>
            <option value="vs-light">Light</option>
            <option value="hc-black">High Contrast</option>
          </select>
        </div>

        <div className="setting-group">
          <label>Font Size</label>
          <input
            type="number"
            value={settings.fontSize}
            onChange={(e) => handleUpdateSettings({ fontSize: parseInt(e.target.value) })}
            min="8"
            max="32"
          />
        </div>

        <div className="setting-group">
          <label>Tab Size</label>
          <input
            type="number"
            value={settings.tabSize}
            onChange={(e) => handleUpdateSettings({ tabSize: parseInt(e.target.value) })}
            min="2"
            max="8"
          />
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <Checkbox
              checked={settings.autoFormat}
              onChange={(checked) => handleUpdateSettings({ autoFormat: checked })}
            />
            Auto-format on save
          </label>
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <Checkbox
              checked={settings.autoSave}
              onChange={(checked) => handleUpdateSettings({ autoSave: checked })}
            />
            Auto-save
          </label>
        </div>
      </div>
    </div>
  );
}
