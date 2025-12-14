import { TypeScriptCompiler } from '@shared/compiler';
import { AppSettings, ScriptFile, UserScript } from '@shared/model';
import { IDEStorageManager } from '@shared/storage';
import { useEffect, useState } from 'react';
import { CodeEditor } from './code-editor/CodeEditor';
import './Scripts.scss';
import { Input } from '@/shared/components/input/Input';
import { Button } from '@/shared/components/button/Button';
import { Checkbox } from '@/shared/components/checkbox/Checkbox';
import { PlusIcon, TrashIcon, XIcon } from 'lucide-react';
import { uuid } from '@/shared/utils';
import { IconButton } from '@/shared/components/icon-button/IconButton';
import { Typography } from '@/shared/components/typography/Typography';

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

  useEffect(() => {
    loadData();
  }, [settings]);

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
      id: uuid(),
      name: '',
      description: '',
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
    <div className="scripts--content">
      <div className="scripts--sidebar">
        <div className="scripts--sidebar-header">
          <Typography variant="subtitle">Scripts</Typography>
          <IconButton onClick={handleCreateScript} title="Create new script">
            <PlusIcon color="grey" size="1rem" />
          </IconButton>
        </div>
        <div className="scripts--list">
          {scripts.map((script) => (
            <div
              key={script.id}
              className={`scripts--list-item ${selectedScript?.id === script.id ? 'active' : ''}`}
              onClick={() => handleScriptSelect(script)}
            >
              <div className="scripts--list-item-header">
                <span className="scripts--list-item-name">{script.name}</span>
                <IconButton
                  className="btn-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteScript(script.id);
                  }}
                  title="Delete script"
                >
                  <TrashIcon color="grey" size="1rem" />
                </IconButton>
              </div>
              <div className="scripts--list-item-status">
                {script.enabled ? '✅ Enabled' : '⭕ Disabled'}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="scripts--editor-area">
        {selectedScript ? (
          <>
            <div className="scripts--editor-header">
              <div className="scripts--script-details">
                <Input
                  label="Name"
                  value={selectedScript.name}
                  onChange={(e) => handleUpdateScriptMeta({ name: e.target.value })}
                />
                <Input
                  label="Description"
                  value={selectedScript.description}
                  onChange={(e) => handleUpdateScriptMeta({ description: e.target.value })}
                />
                <Checkbox
                  label="Enabled"
                  checked={selectedScript.enabled}
                  onChange={(value) => handleUpdateScriptMeta({ enabled: value })}
                />
              </div>
              <div className="scripts--editor-actions">
                <Button onClick={handleSaveFile}>💾 Save</Button>
                <Button onClick={handleCompile}>🔧 Compile & Bundle</Button>
              </div>
            </div>
            <div className="scripts--url-patterns">
              <Typography variant="body">URL Patterns</Typography>
              <div className="scripts--patterns-list">
                {selectedScript.urlPatterns.map((pattern, index) => (
                  <div key={index} className="scripts--pattern-item">
                    <span>{pattern}</span>
                    <Button onClick={() => handleRemoveUrlPattern(index)}>
                      <XIcon />
                    </Button>
                  </div>
                ))}
                <Button onClick={handleAddUrlPattern}>
                  <PlusIcon />
                </Button>
              </div>
            </div>
            <div className="scripts--editor-container">
              {selectedFile && (
                <div className="scripts--editor">
                  <CodeEditor value={selectedFile.content} onChange={handleEditorChange} />
                </div>
              )}
              <div className="scripts--compilation">
                {typeCheckErrors.length > 0 && (
                  <div className="scripts--compilation-type-errors">
                    <Typography variant="subtitle">Type Check Errors:</Typography>
                    {typeCheckErrors.map((error, index) => (
                      <div key={index} className="scripts--compilation-type-errors-error">
                        {error}
                      </div>
                    ))}
                  </div>
                )}
                {compileOutput && (
                  <div className="scripts--compilation-output">
                    <Typography variant="subtitle">Compiled Output:</Typography>
                    <pre>{compileOutput}</pre>
                  </div>
                )}
              </div>
            </div>
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
