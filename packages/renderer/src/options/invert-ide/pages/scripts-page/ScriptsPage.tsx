import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Switch } from "@/shared/components/switch/Switch";
import { Typography } from "@/shared/components/typography/Typography";
import { uuid } from "@/shared/utils";
import { TypeScriptCompiler } from "@shared/compiler";
import { Userscript, Userscripts } from "@shared/model";
import { StorageManager } from "@shared/storage";
import { EllipsisIcon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CodeEditor } from "../../code-editor/CodeEditor";
import "./ScriptsPage.scss";
import { ScriptMetadata } from "./script-metadata/ScriptMetadata";

export function ScriptsPage() {
  const [scripts, setScripts] = useState<Userscripts>({});
  const [selectedScript, setSelectedScript] = useState<Userscript>(null);
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

  const loadData = async () => {
    const loadedScripts = await StorageManager.getScripts();
    setScripts(loadedScripts);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onCreateScript = async () => {
    const newScript: Userscript = {
      id: uuid(),
      name: "New Script",
      enabled: false,
      code: {
        script: "// Your code here",
        stylesheet: "/* Your styles here */",
      },
      urlPatterns: [],
      runAt: "beforePageLoad",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await StorageManager.saveScript(newScript);

    await loadData();

    setSelectedScript(newScript);
  };

  const onDeleteScript = async (scriptId: string) => {
    if (confirm("Are you sure you want to delete this script?")) {
      await StorageManager.deleteScript(scriptId);
      setSelectedScript(null);
      await loadData();
    }
  };

  const onEditorSave = async (language: "typescript" | "scss", code: string) => {
    if (language === "typescript") {
      const output = TypeScriptCompiler.compile(code);

      if (output.success) {
        try {
          await StorageManager.saveScript({
            ...selectedScript,
            code: {
              ...selectedScript.code,
              script: output.code,
            },
            updatedAt: Date.now(),
          });
        } catch (error) {
          console.error("Failed to save script:", error);
          // Revert unsaved changes indicator if save fails
          setUnsavedChanges((prev) => {
            const newSet = new Set(prev);
            newSet.add(selectedScript.id);
            return newSet;
          });
        }
      } else {
        // Handle compilation errors (could show in UI)
        console.error("Compilation Error:", output.error);
      }

      return;
    }
  };

  const onUpdateScriptMeta = async (updates: Partial<Userscript>) => {
    const updated = { ...selectedScript, ...updates, updatedAt: Date.now() };
    await StorageManager.saveScript(updated);
    setSelectedScript(updated);
    await loadData();
  };

  const renderScriptListItem = (script: Userscript) => {
    return (
      <div
        key={script.id}
        className={`scripts--list-item ${selectedScript?.id === script.id ? "scripts--list-item-active" : ""}`}
        onClick={() => setSelectedScript(script)}
      >
        {unsavedChanges.has(script.id) && <div className="scripts--list-item-unsaved" />}
        <span className="scripts--list-item-name">{script.name}</span>
        <div className="scripts--list-item-actions">
          <Switch
            checked={script.enabled}
            onChange={() => onUpdateScriptMeta({ enabled: !script.enabled })}
          />
          <IconButton
            icon={EllipsisIcon}
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteScript(script.id);
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
            onClick={onCreateScript}
            title="Create new script"
          ></IconButton>
        </div>
        <div className="scripts--list">
          {Object.values(scripts ?? []).map((script) => renderScriptListItem(script))}
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
                      key={selectedScript.id}
                      language="typescript"
                      contents={selectedScript.code.script}
                      onSave={(code) => onEditorSave("typescript", code)}
                    />
                  </div>
                  <div className="scripts--editor">
                    <CodeEditor
                      language="scss"
                      contents={selectedScript.code.stylesheet}
                      onSave={(code) => onEditorSave("scss", code)}
                    />
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
