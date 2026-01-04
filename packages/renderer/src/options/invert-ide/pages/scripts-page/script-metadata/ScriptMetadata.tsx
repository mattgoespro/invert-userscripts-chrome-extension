import { Input } from "@/shared/components/input/Input";
import { Userscript } from "@shared/model";
import { StorageManager } from "@shared/storage";
import "./ScriptMetadata.scss";

type ScriptMetadataProps = {
  script: Userscript;
};

export function ScriptMetadata({ script }: ScriptMetadataProps) {
  const handleUpdateScriptMeta = async (updates: Partial<Userscript>) => {
    const updated = { ...script, ...updates, updatedAt: Date.now() };
    await StorageManager.saveScript(updated);
  };

  return (
    <div className="script-metadata--wrapper">
      <Input
        className="script-metadata--name"
        value={script.name}
        placeholder="Script name..."
        onChange={(e) => handleUpdateScriptMeta({ name: e.target.value })}
      />
      <Input
        className="script-metadata--url-patterns"
        value={script.urlPatterns?.join(", ")}
        placeholder="URL Patterns (comma separated)..."
        onChange={(e) =>
          handleUpdateScriptMeta({ urlPatterns: e.target.value.split(",").map((p) => p.trim()) })
        }
      />
    </div>
  );
}
