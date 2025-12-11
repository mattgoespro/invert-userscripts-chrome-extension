import { AppSettings } from '@shared/model';
import { IDEStorageManager } from '@shared/storage';
import { useEffect, useState } from 'react';
import { Sidebar, SidebarButton } from './sidebar/Sidebar';
import './VertexIde.scss';
import { Scripts } from './pages/scripts/Scripts';
import { Modules } from './pages/modules/Modules';
import { Settings } from './pages/settings/Settings';

export function VertexIde() {
  const [activeTab, setActiveTab] = useState<SidebarButton>('scripts');
  const [settings, setSettings] = useState<AppSettings>(null);

  const loadData = async () => {
    const [loadedSettings] = await Promise.all([IDEStorageManager.getSettings()]);
    setSettings(loadedSettings);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>⚡ Vertex IDE Userscripts</h1>
        <div className="header-subtitle">Browser-based IDE for TypeScript userscripts</div>
      </div>
      <div className="dashboard-content">
        <div className="sidebar-wrapper">
          <Sidebar active={activeTab} onNavigate={setActiveTab} />
        </div>
        <div className="sidebar-content">
          {activeTab === 'scripts' && <Scripts settings={settings} />}
          {activeTab === 'modules' && <Modules />}
          {activeTab === 'settings' && <Settings settings={settings} />}
        </div>
      </div>
    </div>
  );
}

export default VertexIde;
