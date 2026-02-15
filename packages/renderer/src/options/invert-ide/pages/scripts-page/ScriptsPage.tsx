import { CodeComment } from "@/shared/components/code-comment/CodeComment";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  createUserscript,
  selectAllUserscripts,
  setCurrentUserscript,
} from "@/shared/store/slices/userscripts.slice";
import { uuid } from "@/shared/utils";
import { PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { ScriptEditor } from "./script-editor/ScriptEditor";
import { ScriptList } from "./script-list/ScriptList";
import "./ScriptsPage.scss";

export function ScriptsPage() {
  const dispatch = useAppDispatch();
  const scripts = useAppSelector(selectAllUserscripts);
  const selectedScript = useAppSelector((state) => state.userscripts.currentUserscript);

  const onCreateScript = async () => {
    const timestamp = Date.now();

    dispatch(
      createUserscript({
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
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    );
  };

  useEffect(() => {
    if (Object.keys(scripts).length === 0 || selectedScript != null) {
      return;
    }

    dispatch(setCurrentUserscript(Object.values(scripts)[0].id));
  }, [scripts]);

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
