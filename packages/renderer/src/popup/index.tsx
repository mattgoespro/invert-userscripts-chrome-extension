import { UserScript } from '@shared/model';
import { IDEStorageManager } from '@shared/storage';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.scss';

export function Popup() {
  const [scripts, setScripts] = useState<UserScript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScripts();
  }, []);

  const loadScripts = async () => {
    try {
      const allScripts = await IDEStorageManager.getScripts();
      setScripts(allScripts);
    } catch (error) {
      console.error('Error loading scripts:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleScript = async (script: UserScript) => {
    const updated = { ...script, enabled: !script.enabled };
    await IDEStorageManager.saveScript(updated);
    await loadScripts();

    // Notify background to reload scripts
    chrome.runtime.sendMessage({ action: 'reloadScripts' });
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>Vertex IDE</h1>
        <button className="btn-options" onClick={openOptions}>
          ⚙️ Options
        </button>
      </div>

      <div className="scripts-list">
        {scripts.length === 0 ? (
          <div className="empty-state">
            <p>No scripts yet</p>
            <button className="btn-primary" onClick={openOptions}>
              Create Script
            </button>
          </div>
        ) : (
          scripts.map((script) => (
            <div key={script.id} className="script-item">
              <div className="script-info">
                <div className="script-name">{script.name}</div>
                <div className="script-description">{script.description}</div>
                <div className="script-patterns">
                  {script.urlPatterns.length > 0 ? (
                    <span className="pattern-count">{script.urlPatterns.length} pattern(s)</span>
                  ) : (
                    <span className="no-patterns">No patterns</span>
                  )}
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={script.enabled}
                  onChange={() => toggleScript(script)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          ))
        )}
      </div>

      <div className="popup-footer">
        <button className="btn-secondary" onClick={openOptions}>
          Manage Scripts
        </button>
      </div>
    </div>
  );
}

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
