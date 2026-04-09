import { CodeEditor } from "@/options/invert-ide/shared/CodeEditor";
import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { Tab } from "@/shared/components/tab-list/Tab";
import { TabContent } from "@/shared/components/tab-list/TabContent";
import { TabList } from "@/shared/components/tab-list/TabList";
import { TabListTitle } from "@/shared/components/tab-list/TabListTitle";
import { ScriptEditorDrawerTab } from "@shared/storage";
import { ChevronsDown, ChevronsUp } from "lucide-react";
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
      className="flex h-full flex-col overflow-hidden"
      barClassName="shrink-0 h-9 pl-md pr-xs bg-surface-raised border-b border-border"
    >
      <TabListTitle>{"// output"}</TabListTitle>
      <Tab
        active={activeTab === "javascript"}
        onClick={() => onTabChange("javascript")}
      >
        <span className="inline-flex items-center rounded-[3px] bg-[rgba(240,219,79,0.12)] px-1.25 py-px text-[9px] font-bold tracking-[0.05em] text-[#f0db4f] uppercase">
          js
        </span>
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
        <span className="inline-flex items-center rounded-[3px] bg-[rgba(111,168,255,0.12)] px-1.25 py-px text-[9px] font-bold tracking-[0.05em] text-[#6fa8ff] uppercase">
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
