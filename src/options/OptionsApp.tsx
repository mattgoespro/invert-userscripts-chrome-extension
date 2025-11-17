import React, { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { TypeScriptCompiler } from '@/utils/compiler';
import { UserScript, ScriptFile, GlobalModule, AppSettings } from '@/types';
import './options.scss';
import { IDEStorageManager } from '@/utils/storage';

type TabView = 'scripts' | 'modules' | 'settings';

const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabView>('scripts');
  const [scripts, setScripts] = useState<UserScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<UserScript | null>(null);
  const [selectedFile, setSelectedFile] = useState<ScriptFile | null>(null);
  const [modules, setModules] = useState<GlobalModule[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [compileOutput, setCompileOutput] = useState<string>('');
  const [typeCheckErrors, setTypeCheckErrors] = useState<string[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [loadedScripts, loadedModules, loadedSettings] = await Promise.all([
      IDEStorageManager.getScripts(),
      IDEStorageManager.getModules(),
      IDEStorageManager.getSettings(),
    ]);
    setScripts(loadedScripts);
    setModules(loadedModules);
    setSettings(loadedSettings);
  };

  const loadScriptFiles = async (scriptId: string) => {
    const files = await IDEStorageManager.getScriptFiles(scriptId);
    if (files.length > 0) {
      const mainFile = files.find((f) => f.isMain) || files[0];
      setSelectedFile(mainFile);
    } else {
      setSelectedFile(null);
    }
  };

  const handleScriptSelect = async (script: UserScript) => {
    setSelectedScript(script);
    await loadScriptFiles(script.id);
    setCompileOutput('');
    setTypeCheckErrors([]);
  };

  const handleCreateScript = async () => {
    const newScript: UserScript = {
      id: Date.now().toString(),
      name: 'New Script',
      description: 'Script description',
      enabled: false,
      code: '',
      urlPatterns: [],
      runAt: 'document_idle',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await IDEStorageManager.saveScript(newScript);

    // Create default main file
    const mainFile: ScriptFile = {
      id: `${newScript.id}-main`,
      scriptId: newScript.id,
      name: 'main.ts',
      language: 'typescript',
      content: '// Start coding your userscript here\nconsole.log("Hello from Vertex IDE!");',
      isMain: true,
    };

    await IDEStorageManager.saveScriptFile(mainFile);
    await loadData();
    handleScriptSelect(newScript);
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (confirm('Are you sure you want to delete this script?')) {
      await IDEStorageManager.deleteScript(scriptId);
      setSelectedScript(null);
      setSelectedFile(null);
      await loadData();
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (selectedFile && value !== undefined) {
      const updated = { ...selectedFile, content: value };
      setSelectedFile(updated);

      // Auto-save if enabled
      if (settings?.autoSave) {
        IDEStorageManager.saveScriptFile(updated);
      }

      // Type check if enabled
      if (settings?.enableTypeChecking && selectedFile.language === 'typescript') {
        const errors = TypeScriptCompiler.typeCheck(value, selectedFile.name);
        setTypeCheckErrors(errors);
      }
    }
  };

  const handleSaveFile = async () => {
    if (selectedFile) {
      await IDEStorageManager.saveScriptFile(selectedFile);
      alert('File saved successfully!');
    }
  };

  const handleCompile = async () => {
    if (!selectedFile) return;

    setCompileOutput('Compiling...');

    const result = TypeScriptCompiler.compile(selectedFile.content, selectedFile.name);

    if (result.success && result.code) {
      setCompileOutput(`// Compiled successfully\n${result.code}`);

      if (result.warnings && result.warnings.length > 0) {
        setCompileOutput(
          `// Warnings:\n${result.warnings.map((w) => `// ${w}`).join('\n')}\n\n${result.code}`
        );
      }

      // Update the script's compiled code
      if (selectedScript) {
        const updated = { ...selectedScript, code: result.code, updatedAt: Date.now() };
        await IDEStorageManager.saveScript(updated);
        setSelectedScript(updated);
      }
    } else {
      setCompileOutput(`// Compilation failed\n// Error: ${result.error}`);
    }
  };

  const handleUpdateScriptMeta = async (updates: Partial<UserScript>) => {
    if (selectedScript) {
      const updated = { ...selectedScript, ...updates, updatedAt: Date.now() };
      await IDEStorageManager.saveScript(updated);
      setSelectedScript(updated);
      await loadData();
    }
  };

  const handleAddUrlPattern = () => {
    if (selectedScript) {
      const pattern = prompt('Enter URL pattern (e.g., https://example.com/*)');
      if (pattern) {
        const patterns = [...selectedScript.urlPatterns, pattern];
        handleUpdateScriptMeta({ urlPatterns: patterns });
      }
    }
  };

  const handleRemoveUrlPattern = (index: number) => {
    if (selectedScript) {
      const patterns = selectedScript.urlPatterns.filter((_, i) => i !== index);
      handleUpdateScriptMeta({ urlPatterns: patterns });
    }
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

  const handleUpdateSettings = async (updates: Partial<AppSettings>) => {
    if (settings) {
      const updated = { ...settings, ...updates };
      await IDEStorageManager.saveSettings(updated);
      setSettings(updated);
    }
  };

  const renderScriptsTab = () => (
    <div className="scripts-tab">
      <div className="scripts-sidebar">
        <div className="sidebar-header">
          <h2>Scripts</h2>
          <button className="btn-icon" onClick={handleCreateScript} title="Create new script">
            &#x002b;
          </button>
        </div>
        <div className="scripts-list">
          {scripts.map((script) => (
            <div
              key={script.id}
              className={`script-item ${selectedScript?.id === script.id ? 'active' : ''}`}
              onClick={() => handleScriptSelect(script)}
            >
              <div className="script-item-header">
                <span className="script-name">{script.name}</span>
                <button
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteScript(script.id);
                  }}
                  title="Delete script"
                >
                  🗑️
                </button>
              </div>
              <div className="script-status">{script.enabled ? '✅ Enabled' : '⭕ Disabled'}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="editor-area">
        {selectedScript ? (
          <>
            <div className="editor-header">
              <div className="script-meta">
                <input
                  type="text"
                  value={selectedScript.name}
                  onChange={(e) => handleUpdateScriptMeta({ name: e.target.value })}
                  className="input-script-name"
                />
                <input
                  type="text"
                  value={selectedScript.description}
                  onChange={(e) => handleUpdateScriptMeta({ description: e.target.value })}
                  className="input-script-description"
                  placeholder="Description"
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedScript.enabled}
                    onChange={(e) => handleUpdateScriptMeta({ enabled: e.target.checked })}
                  />
                  Enabled
                </label>
              </div>
              <div className="editor-actions">
                <button className="btn-primary" onClick={handleSaveFile}>
                  💾 Save
                </button>
                <button className="btn-primary" onClick={handleCompile}>
                  🔧 Compile & Bundle
                </button>
              </div>
            </div>
            <div className="url-patterns">
              <h3>URL Patterns</h3>
              <div className="patterns-list">
                {selectedScript.urlPatterns.map((pattern, index) => (
                  <div key={index} className="pattern-item">
                    <span>{pattern}</span>
                    <button className="btn-remove" onClick={() => handleRemoveUrlPattern(index)}>
                      ✖
                    </button>
                  </div>
                ))}
                <button className="btn-add-pattern" onClick={handleAddUrlPattern}>
                  + Add Pattern
                </button>
              </div>
            </div>
            <div className="editor-container">
              {selectedFile && (
                <Editor
                  height="400px"
                  language={
                    selectedFile.language === 'typescript' ? 'typescript' : selectedFile.language
                  }
                  value={selectedFile.content}
                  onChange={handleEditorChange}
                  theme={settings?.editorTheme || 'vs-dark'}
                  options={{
                    minimap: { enabled: false },
                    fontSize: settings?.fontSize || 14,
                    tabSize: settings?.tabSize || 2,
                    automaticLayout: true,
                    formatOnPaste: settings?.autoFormat,
                    formatOnType: settings?.autoFormat,
                  }}
                  onMount={(editor) => {
                    editorRef.current = editor;
                  }}
                />
              )}
            </div>
            {typeCheckErrors.length > 0 && (
              <div className="type-check-errors">
                <h4>Type Check Errors:</h4>
                {typeCheckErrors.map((error, index) => (
                  <div key={index} className="error-item">
                    {error}
                  </div>
                ))}
              </div>
            )}
            {compileOutput && (
              <div className="compile-output">
                <h4>Compiled Output:</h4>
                <pre>{compileOutput}</pre>
              </div>
            )}
          </>
        ) : (
          <div className="empty-editor">
            <p>Select a script or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderModulesTab = () => (
    <div className="modules-tab">
      <div className="tab-header">
        <h2>Global Modules</h2>
        <button className="btn-primary" onClick={handleCreateModule}>
          + Add Module
        </button>
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
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={module.enabled}
                  onChange={() => handleToggleModule(module)}
                />
                <span className="toggle-slider"></span>
              </label>
              <button className="btn-delete" onClick={() => handleDeleteModule(module.id)}>
                🗑️
              </button>
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

  const renderSettingsTab = () => (
    <div className="settings-tab">
      <h2>Settings</h2>
      {settings && (
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
              <input
                type="checkbox"
                checked={settings.autoFormat}
                onChange={(e) => handleUpdateSettings({ autoFormat: e.target.checked })}
              />
              Auto-format on save
            </label>
          </div>

          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => handleUpdateSettings({ autoSave: e.target.checked })}
              />
              Auto-save
            </label>
          </div>

          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.enableTypeChecking}
                onChange={(e) => handleUpdateSettings({ enableTypeChecking: e.target.checked })}
              />
              Enable type checking
            </label>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="options-container">
      <div className="options-header">
        <h1>⚡ Vertex IDE Userscripts</h1>
        <div className="header-subtitle">Browser-based IDE for TypeScript userscripts</div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'scripts' ? 'active' : ''}`}
          onClick={() => setActiveTab('scripts')}
        >
          📝 Scripts
        </button>
        <button
          className={`tab ${activeTab === 'modules' ? 'active' : ''}`}
          onClick={() => setActiveTab('modules')}
        >
          📦 Global Modules
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'scripts' && renderScriptsTab()}
        {activeTab === 'modules' && renderModulesTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </div>
    </div>
  );
};

export default OptionsApp;
