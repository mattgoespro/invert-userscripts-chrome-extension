import { GlobalModule } from '@shared/model';
import './Modules.scss';
import { IDEStorageManager } from '@shared/storage';
import { useState } from 'react';
import { Button } from '@/shared/components/button/Button';
import { Checkbox } from '@/shared/components/checkbox/Checkbox';
import { IconButton } from '@/shared/components/icon-button/IconButton';
import { DeleteIcon } from 'lucide-react';
import { Typography } from '@/shared/components/typography/Typography';

export function Modules() {
  const [modules, setModules] = useState<GlobalModule[]>([]);

  const loadData = async () => {
    const loadedModules = await IDEStorageManager.getModules();
    setModules(loadedModules);
  };

  const handleCreateModule = async () => {
    const name = prompt('Module name:');
    if (!name) return;

    const url = prompt('CDN URL:');
    if (!url) return;

    const newModule: GlobalModule = {
      id: Date.now().toString(),
      name,
      url,
      enabled: true,
    };

    await IDEStorageManager.saveModule(newModule);
    await loadData();
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (confirm('Delete this module?')) {
      await IDEStorageManager.deleteModule(moduleId);
      await loadData();
    }
  };

  const handleToggleModule = async (module: GlobalModule) => {
    const updated = { ...module, enabled: !module.enabled };
    await IDEStorageManager.saveModule(updated);
    await loadData();
  };

  return (
    <div className="modules-content">
      <div className="modules-header">
        <Typography variant="button">Global Modules</Typography>
        <Button className="btn-primary" onClick={handleCreateModule}>
          + Add Module
        </Button>
      </div>
      <div className="modules-list">
        {modules.map((module) => (
          <div key={module.id} className="module-item">
            <div className="module-info">
              <strong>{module.name}</strong>
              <div className="module-url">{module.url}</div>
              {module.version && <div className="module-version">v{module.version}</div>}
            </div>
            <div className="module-actions">
              <Checkbox
                label="Enabled"
                checked={module.enabled}
                onChange={() => handleToggleModule(module)}
              />
              <IconButton className="btn-delete" onClick={() => handleDeleteModule(module.id)}>
                <DeleteIcon />
              </IconButton>
            </div>
          </div>
        ))}
        {modules.length === 0 && (
          <div className="empty-state">
            <p>No global modules yet. Add CDN libraries that can be shared across all scripts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
