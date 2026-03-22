import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Tab } from "@/shared/components/tab-list/Tab";
import { TabContent } from "@/shared/components/tab-list/TabContent";
import { TabList } from "@/shared/components/tab-list/TabList";
import { TabListTitle } from "@/shared/components/tab-list/TabListTitle";
import { ScriptEditorDrawerTab } from "@shared/storage";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { Typography } from "@/shared/components/typography/Typography";
import { Userscript } from "@shared/model";

type ScriptEditorDrawerProps = {
  script: Userscript;
  javascript: string;
  css: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

export function ScriptEditorDrawer({
  script,
  javascript,
  css,
  isCollapsed,
  onToggleCollapse,
}: ScriptEditorDrawerProps) {
  const { globalState, updateGlobalState } = useGlobalState();
  const activeTab = globalState.outputDrawerActiveTab;

  const onTabChange = (tab: ScriptEditorDrawerTab) => {
    updateGlobalState({ outputDrawerActiveTab: tab });
  };

  return (
    <TabList
      className="flex flex-col h-full overflow-hidden"
      barClassName="shrink-0 h-9 pl-md pr-xs bg-surface-raised border-b border-border"
    >
      <TabListTitle>{"// output"}</TabListTitle>
      <Tab
        active={activeTab === "javascript"}
        onClick={() => onTabChange("javascript")}
      >
        <Typography
          variant="caption"
          className="inline-flex items-center py-px px-1.25 rounded-[3px] text-[9px] font-bold tracking-[0.05em] uppercase text-[#f0db4f] bg-[rgba(240,219,79,0.12)]"
        >
          js
        </Typography>
        javascript
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
        <span className="inline-flex items-center py-px px-1.25 rounded-[3px] text-[9px] font-bold tracking-[0.05em] uppercase text-[#6fa8ff] bg-[rgba(111,168,255,0.12)]">
          css
        </span>
        css
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
        title={isCollapsed ? "Expand output" : "Collapse output"}
      />
    </TabList>
  );
}
