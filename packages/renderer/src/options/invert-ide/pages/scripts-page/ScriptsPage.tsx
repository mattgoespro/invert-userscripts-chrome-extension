import { CodeComment } from "@/shared/components/code-comment/CodeComment";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { ResizeHandle } from "@/shared/components/resize-handle/ResizeHandle";
import { Typography } from "@/shared/components/typography/Typography";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  selectAllUserscripts,
  setCurrentUserscript,
} from "@/shared/store/slices/userscripts";
import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { Group, Panel } from "react-resizable-panels";
import { ScriptEditor } from "./script-editor/ScriptEditor";
import { ScriptList } from "./script-list/ScriptList";
import "./ScriptsPage.scss";
import { createUserscript } from "@/shared/store/slices/userscripts/thunks.userscripts";

export function ScriptsPage() {
  const dispatch = useAppDispatch();
  const scripts = useAppSelector(selectAllUserscripts);
  const selectedScript = useAppSelector(
    (state) => state.userscripts.currentUserscript
  );
  const { globalState, updateGlobalState, updatePanelSizes } = useGlobalState();

  const onCreateScript = async () => {
    dispatch(createUserscript());
  };

  // On first load, restore the previously selected script from UI state.
  useEffect(() => {
    if (Object.keys(scripts).length === 0) {
      return;
    }

    if (selectedScript != null) {
      return;
    }

    const restoredId = globalState.selectedScriptId;
    const target =
      restoredId && scripts[restoredId]
        ? restoredId
        : Object.values(scripts)[0].id;
    dispatch(setCurrentUserscript(target));
  }, [scripts]);

  const onScriptSelected = (scriptId: string) => {
    dispatch(setCurrentUserscript(scriptId));
    updateGlobalState({ selectedScriptId: scriptId });
  };

  return (
    <Group
      orientation="horizontal"
      id="scripts-page-panels"
      className="scripts--content"
      defaultLayout={{
        "scripts-sidebar": globalState.panelSizes.scriptListSidebarWidth,
        "scripts-editor": 100 - globalState.panelSizes.scriptListSidebarWidth,
      }}
      onLayoutChanged={(layout) => {
        const sidebarWidth = layout["scripts-sidebar"];
        if (sidebarWidth != null) {
          updatePanelSizes({ scriptListSidebarWidth: sidebarWidth });
        }
      }}
    >
      <Panel id="scripts-sidebar" minSize="15%" maxSize="30%">
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
          <ScriptList onScriptSelected={onScriptSelected} />
        </div>
      </Panel>
      <ResizeHandle direction="horizontal" />
      <Panel id="scripts-editor" minSize="70%" maxSize="85%">
        {selectedScript ? (
          <ScriptEditor />
        ) : (
          <CodeComment className="scripts--empty-editor">
            Select a script to start editing.
          </CodeComment>
        )}
      </Panel>
    </Group>
  );
}
