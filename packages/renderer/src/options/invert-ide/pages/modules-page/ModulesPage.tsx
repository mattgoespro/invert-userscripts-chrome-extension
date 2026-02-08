import { GlobalModule, GlobalModules } from "@shared/model";
import "./ModulesPage.scss";
import { StorageManager } from "@shared/storage";
import { useState } from "react";
import { Button } from "@/shared/components/button/Button";
import { Checkbox } from "@/shared/components/checkbox/Checkbox";
import { CodeComment } from "@/shared/components/code-comment/CodeComment";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { DeleteIcon } from "lucide-react";
import { Typography } from "@/shared/components/typography/Typography";

export function ModulesPage() {
  const [modules, setModules] = useState<GlobalModules>({});

  const loadData = async () => {
    const loadedModules = await StorageManager.getAllModules();
    setModules(loadedModules);
  };

  const handleCreateModule = async () => {
    const name = prompt("Module name:");
    if (!name) return;

    const url = prompt("CDN URL:");
    if (!url) return;

    const newModule: GlobalModule = {
      id: Date.now().toString(),
      name,
      url,
      enabled: true,
    };

    await StorageManager.saveModule(newModule);
    await loadData();
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (confirm("Delete this module?")) {
      await StorageManager.deleteModule(moduleId);
      await loadData();
    }
  };

  const handleToggleModule = async (module: GlobalModule) => {
    const updated = { ...module, enabled: !module.enabled };
    await StorageManager.saveModule(updated);
    await loadData();
  };

  return (
    <div className="modules--content">
      <div className="modules--header">
        <div className="modules--header-title">
          <span className="modules--header-title-keyword">import</span>
          <span className="modules--header-title-punctuation">{"{"}</span>
          <Typography variant="subtitle">Modules</Typography>
          <span className="modules--header-title-punctuation">{"}"}</span>
          <span className="modules--header-title-keyword">from</span>
          <span className="modules--header-title-path">
            <span className="modules--header-title-punctuation">'</span>
            <span className="modules--header-title-string">cdn</span>
            <span className="modules--header-title-punctuation">'</span>
          </span>
        </div>
        <Button onClick={handleCreateModule}>+ Add Module</Button>
      </div>
      <div className="modules--list">
        {Object.values(modules ?? {}).map((module) => (
          <div key={module.id} className="modules--list-item">
            <div className="modules--list-item-info">
              <strong>{module.name}</strong>
              <div className="modules--list-item-url">{module.url}</div>
            </div>
            <div className="modules--list-item-actions">
              <Checkbox
                label="Enabled"
                checked={module.enabled}
                onChange={() => handleToggleModule(module)}
              />
              <IconButton
                icon={DeleteIcon}
                className="btn-delete"
                onClick={() => handleDeleteModule(module.id)}
              >
                <DeleteIcon />
              </IconButton>
            </div>
          </div>
        ))}
        {Object.values(modules ?? {}).length === 0 && (
          <div className="modules--list-items-empty">
            <CodeComment>No modules imported yet.</CodeComment>
          </div>
        )}
      </div>
    </div>
  );
}
