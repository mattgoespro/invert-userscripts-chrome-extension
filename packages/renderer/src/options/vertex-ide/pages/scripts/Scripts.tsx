import { AppSettings, ScriptFile, UserScript } from '@shared/model';
import { CodeEditor } from '../../code-editor/CodeEditor';
import './Scripts.scss';
import { IDEStorageManager } from '@shared/storage';
import { useState } from 'react';
import { TypeScriptCompiler } from '@shared/compiler';

type ScriptsProps = {
  settings: AppSettings;
};

export function Scripts({ settings }: ScriptsProps) {
  const [scripts, setScripts] = useState<UserScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<UserScript>(null);
  const [selectedFile, setSelectedFile] = useState<ScriptFile>(null);
  const [compileOutput, setCompileOutput] = useState<string>('');
  const [typeCheckErrors, setTypeCheckErrors] = useState<string[]>([]);

  const loadData = async () => {
    const [loadedScripts] = await Promise.all([
      IDEStorageManager.getScripts(),
      IDEStorageManager.getModules(),
      IDEStorageManager.getSettings(),
    ]);
    setScripts(loadedScripts);
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

  const handleEditorChange = (value: string) => {
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

  return (
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
                <CodeEditor value={selectedFile.content} onChange={handleEditorChange} />
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
}
