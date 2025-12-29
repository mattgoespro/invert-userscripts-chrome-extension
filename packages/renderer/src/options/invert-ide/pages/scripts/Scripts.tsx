import { IconButton } from '@/shared/components/icon-button/IconButton';
import { Switch } from '@/shared/components/switch/Switch';
import { Typography } from '@/shared/components/typography/Typography';
import { uuid } from '@/shared/utils';
import { TypeScriptCompiler } from '@shared/compiler';
import { AppSettings, ScriptFile, UserScript } from '@shared/model';
import { IDEStorageManager } from '@shared/storage';
import { EllipsisIcon, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CodeEditor } from '../../code-editor/CodeEditor';
import './Scripts.scss';
import { ScriptMetadata } from './script-metadata/ScriptMetadata';

type ScriptsProps = {
  settings: AppSettings;
};

export function Scripts({ settings }: ScriptsProps) {
  const [scripts, setScripts] = useState<UserScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<UserScript>(null);
  const [selectedFile, setSelectedFile] = useState<ScriptFile>(null);

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
  };

  const handleCreateScript = async () => {
    const newScript: UserScript = {
      id: uuid(),
      name: 'New Script',
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
      content: '// Start coding your userscript here\nconsole.log("Hello from Invert IDE!");',
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

  const handleEditorChange = async (code: string) => {
    const output = TypeScriptCompiler.compile(code);

    if (output.success) {
      const updatedFile: ScriptFile = {
        ...selectedFile,
        content: code,
      };
      await IDEStorageManager.saveScriptFile(updatedFile);
      setSelectedFile(updatedFile);
    } else {
      // Handle compilation errors (could show in UI)
      console.error('Compilation Error:', output.error);
    }
  };

  const handleUpdateScriptMeta = async (updates: Partial<UserScript>) => {
    const updated = { ...selectedScript, ...updates, updatedAt: Date.now() };
    await IDEStorageManager.saveScript(updated);
    setSelectedScript(updated);
    await loadData();
  };

  const createScriptListItem = (script: UserScript) => {
    return (
      <div
        key={script.id}
        className={`scripts--list-item ${selectedScript?.id === script.id ? 'active' : ''}`}
        onClick={() => handleScriptSelect(script)}
      >
        <span className="scripts--list-item-name">{script.name}</span>
        <div className="scripts--list-item-actions">
          <Switch
            checked={script.enabled}
            onChange={() => handleUpdateScriptMeta({ enabled: !script.enabled })}
          />
          <IconButton
            icon={EllipsisIcon}
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              handleDeleteScript(script.id);
            }}
            title="More"
          ></IconButton>
        </div>
      </div>
    );
  };

  return (
    <div className="scripts--content">
      <div className="scripts--sidebar">
        <div className="scripts--sidebar-header">
          <Typography variant="subtitle">Scripts</Typography>
          <IconButton
            icon={PlusIcon}
            size="sm"
            onClick={handleCreateScript}
            title="Create new script"
          ></IconButton>
        </div>
        <div className="scripts--list">{scripts.map((script) => createScriptListItem(script))}</div>
      </div>
      <div className="scripts--editor-area">
        {selectedScript ? (
          <>
            <div className="scripts--editor-header">
              <ScriptMetadata script={selectedScript} />
            </div>
            <div className="scripts--editor-container">
              {selectedFile && (
                <>
                  <div className="scripts--editor">
                    <CodeEditor
                      language="typescript"
                      code={selectedFile.content}
                      onChange={handleEditorChange}
                    />
                  </div>
                  <div className="scripts--editor">
                    <CodeEditor language="scss" code={''} onChange={handleEditorChange} />
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="scripts--empty-editor">
            <Typography variant="caption">Select a script or create a new one</Typography>
          </div>
        )}
      </div>
    </div>
  );
}
