import { CodeEditor } from "@/options/invert-ide/shared/CodeEditor";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Tab } from "@/shared/components/tab-list/Tab";
import { TabContent } from "@/shared/components/tab-list/TabContent";
import { TabList } from "@/shared/components/tab-list/TabList";
import { ScriptEditorDrawerTab } from "@shared/storage";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import clsx from "clsx";
import { Userscript } from "@shared/model";
import { ErrorPanel } from "./ErrorPanel";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  selectOutputDrawerActiveTab,
  setOutputDrawerActiveTab,
} from "@/shared/store/slices/ui";
import { selectErrorCount } from "@/shared/store/slices/workspace";
import { CompilationError } from "@shared/errors";
import type * as monaco from "monaco-editor";

function formatBytes(contents: string): string {
  const bytes = new TextEncoder().encode(contents).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

type ScriptEditorDrawerProps = {
  script: Userscript;
  javascript: string;
  css: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  editorInstances?: Partial<
    Record<CompilationError["language"], monaco.editor.IStandaloneCodeEditor>
  >;
};

export function ScriptEditorDrawer({
  script,
  javascript,
  css,
  isCollapsed,
  onToggleCollapse,
  editorInstances,
}: ScriptEditorDrawerProps) {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(selectOutputDrawerActiveTab);
  const errorCount = useAppSelector((state) =>
    selectErrorCount(state, script.id)
  );

  const onTabChange = (tab: ScriptEditorDrawerTab) => {
    dispatch(setOutputDrawerActiveTab(tab));
  };

  return (
    <TabList
      className="flex h-full flex-col overflow-hidden"
      barClassName="shrink-0 h-9 gap-lg pl-md pr-xs bg-surface-panel border-b border-border"
    >
      <Tab
        active={activeTab === "errors"}
        onClick={() => onTabChange("errors")}
      >
        Problems{" "}
        <span
          className={clsx(
            "tabular-nums",
            errorCount > 0 ? "text-error-accent" : "text-text-muted-strong"
          )}
        >
          {errorCount}
        </span>
        {!isCollapsed && (
          <TabContent>
            <ErrorPanel
              scriptId={script.id}
              onErrorClick={(error) => {
                const editorInstance = editorInstances?.[error.language];

                if (editorInstance) {
                  editorInstance.revealLineInCenter(error.line);
                  editorInstance.setPosition({
                    lineNumber: error.line,
                    column: error.column,
                  });
                  editorInstance.focus();
                }
              }}
            />
          </TabContent>
        )}
      </Tab>
      <Tab
        active={activeTab === "javascript"}
        onClick={() => onTabChange("javascript")}
      >
        JavaScript{" "}
        <span className="text-text-muted-strong tabular-nums">
          {formatBytes(javascript)}
        </span>
        {!isCollapsed && (
          <TabContent>
            <CodeEditor
              modelId={`javascript-compiled-${script}`}
              language="typescript"
              contents={javascript}
              editable={false}
              settingsOverride={{ fontSize: 12 }}
            />
          </TabContent>
        )}
      </Tab>
      <Tab active={activeTab === "css"} onClick={() => onTabChange("css")}>
        CSS{" "}
        <span className="text-text-muted-strong tabular-nums">
          {formatBytes(css)}
        </span>
        {!isCollapsed && (
          <TabContent>
            <CodeEditor
              modelId={`css-compiled-${script}`}
              language="scss"
              contents={css}
              editable={false}
              settingsOverride={{ fontSize: 12 }}
            />
          </TabContent>
        )}
      </Tab>
      <IconButton
        className="ml-auto"
        icon={isCollapsed ? ChevronsUp : ChevronsDown}
        variant="secondary"
        size="sm"
        onClick={onToggleCollapse}
        title={isCollapsed ? "Expand drawer" : "Collapse drawer"}
      />
    </TabList>
  );
}
