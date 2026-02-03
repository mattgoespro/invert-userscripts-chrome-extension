import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { createUserscript } from "@/shared/store/slices/userscripts.slice";
import { uuid } from "@/shared/utils";
import { Userscript } from "@shared/model";
import { PlusIcon } from "lucide-react";
import { ScriptEditor } from "./script-editor/ScriptEditor";
import { ScriptList } from "./script-list/ScriptList";
import "./ScriptsPage.scss";
import { CodeComment } from "@/shared/components/code-comment/CodeComment";

export function ScriptsPage() {
  const dispatch = useAppDispatch();
  const selectedScript = useAppSelector((state) => state.userscripts.currentUserscript);

  const onCreateScript = async () => {
    const newScript: Userscript = {
      id: uuid(),
      name: "New Script",
      enabled: false,
      status: "modified",
      code: {
        source: {
          typescript: "// Your code here",
          scss: "/* Your styles here */",
        },
        compiled: {
          javascript: "",
          css: "",
        },
      },
      urlPatterns: [],
      runAt: "beforePageLoad",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    dispatch(createUserscript(newScript));
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
        <ScriptEditor />
      ) : (
        <CodeComment className="scripts--empty-editor">
          Select a script to start editing.
        </CodeComment>
      )}
    </div>
  );
}
