import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { addUserscript, updateUserscript } from "@/shared/store/slices/userscripts.slice";
import { uuid } from "@/shared/utils";
import { TypeScriptCompiler } from "@shared/compiler";
import { Userscript } from "@shared/model";
import { PlusIcon } from "lucide-react";
import { ScriptEditor } from "./script-editor/ScriptEditor";
import { ScriptList } from "./script-list/ScriptList";
import "./ScriptsPage.scss";

export function ScriptsPage() {
  const dispatch = useAppDispatch();
  const selectedScript = useAppSelector((state) => state.userscripts.selectedScript);

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

    dispatch(addUserscript(newScript));
  };

  const onEditorSave = async (language: "typescript" | "scss", code: string) => {
    if (language === "typescript") {
      const output = TypeScriptCompiler.compile(code);

      if (output.success) {
        dispatch(
          updateUserscript({
            ...selectedScript,
            code: {
              ...selectedScript.code,
              script: output.code,
            },
            updatedAt: Date.now(),
          })
        );
      } else {
        // Handle compilation errors (could show in UI)
        console.error("Compilation Error:", output.error);
      }

      return;
    }
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
        <ScriptList></ScriptList>
      </div>
      {selectedScript ? (
        <ScriptEditor script={selectedScript} onSave={onEditorSave} />
      ) : (
        <div className="scripts--empty-editor">
          <Typography variant="caption">Select a script or create a new one</Typography>
        </div>
      )}
    </div>
  );
}
