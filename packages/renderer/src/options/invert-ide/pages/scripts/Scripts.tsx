import { IconButton } from '@/shared/components/icon-button/IconButton';
import { Switch } from '@/shared/components/switch/Switch';
import { Typography } from '@/shared/components/typography/Typography';
import { uuid } from '@/shared/utils';
import { TypeScriptCompiler } from '@shared/compiler';
import { Userscript, Userscripts } from '@shared/model';
import { StorageManager } from '@shared/storage';
import { EllipsisIcon, PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CodeEditor } from '../../code-editor/CodeEditor';
import './Scripts.scss';
import { ScriptMetadata } from './script-metadata/ScriptMetadata';

export function Scripts() {
  const [scripts, setScripts] = useState<Userscripts>({});
  const [selectedScript, setSelectedScript] = useState<Userscript>(null);

  const loadData = async () => {
    const loadedScripts = await StorageManager.getScripts();
    setScripts(loadedScripts);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScriptSelect = async (script: Userscript) => {
    setSelectedScript(script);
  };

  const handleCreateScript = async () => {
    const newScript: Userscript = {
      id: uuid(),
      name: 'New Script',
      enabled: false,
      code: '',
      urlPatterns: [],
      runAt: 'document_idle',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await StorageManager.saveScript(newScript);

    await loadData();

    handleScriptSelect(newScript);
  };

  const handleDeleteScript = async (scriptId: string) => {
    if (confirm('Are you sure you want to delete this script?')) {
      await StorageManager.deleteScript(scriptId);
      setSelectedScript(null);
      await loadData();
    }
  };

  const handleEditorChange = async (code: string) => {
    const output = TypeScriptCompiler.compile(code);

    if (output.success) {
      await StorageManager.saveScript({
        ...selectedScript,
        code,
        updatedAt: Date.now(),
      });
      const updatedFile = { ...selectedScript, code };
      setSelectedScript(updatedFile);
    } else {
      // Handle compilation errors (could show in UI)
      console.error('Compilation Error:', output.error);
    }
  };

  const handleUpdateScriptMeta = async (updates: Partial<Userscript>) => {
    const updated = { ...selectedScript, ...updates, updatedAt: Date.now() };
    await StorageManager.saveScript(updated);
    setSelectedScript(updated);
    await loadData();
  };

  const createScriptListItem = (script: Userscript) => {
    console.log('Script item: ', script.id);
    return (
      <div
        key={script.id}
        className={`scripts--list-item ${selectedScript?.id === script.id ? 'scripts--list-item-active' : ''}`}
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
        <div className="scripts--list">
          {Object.values(scripts ?? []).map((script) => createScriptListItem(script))}
        </div>
      </div>
      <div className="scripts--editor-area">
        {selectedScript ? (
          <>
            <div className="scripts--editor-header">
              <ScriptMetadata script={selectedScript} />
            </div>
            <div className="scripts--editor-container">
              {selectedScript && (
                <>
                  <div className="scripts--editor">
                    <CodeEditor
                      language="typescript"
                      code={selectedScript.code}
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
