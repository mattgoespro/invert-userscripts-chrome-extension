import { Input } from "@/shared/components/input/Input";
import { Userscript } from "@shared/model";
import "./ScriptMetadata.scss";
import { useAppDispatch } from "@/shared/store/hooks";
import { AppDispatch } from "@/shared/store/store";
import { updateUserscript } from "@/shared/store/slices/userscripts.slice";

type ScriptMetadataProps = {
  script: Userscript;
};

export function ScriptMetadata({ script }: ScriptMetadataProps) {
  const dispatch: AppDispatch = useAppDispatch();

  const onUpdateScriptMeta = async (updates: Partial<Userscript>) => {
    dispatch(updateUserscript({ ...script, ...updates }));
  };

  return (
    <div className="script-metadata--wrapper">
      <Input
        className="script-metadata--name"
        value={script.name}
        placeholder="Script name..."
        onChange={(e) => onUpdateScriptMeta({ name: e.target.value })}
      />
      <Input
        className="script-metadata--url-patterns"
        value={script.urlPatterns?.join(", ")}
        placeholder="URL Patterns (comma separated)..."
        onChange={(e) =>
          onUpdateScriptMeta({ urlPatterns: e.target.value.split(",").map((p) => p.trim()) })
        }
      />
    </div>
  );
}
