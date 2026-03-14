import { CodeEditor } from "@/options/invert-ide/components/code-editor/CodeEditor";
import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import { OutputDrawerTab } from "@shared/model";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import "./CompiledOutputDrawer.scss";

type CompiledOutputDrawerProps = {
  /** Script ID — used to key the editor models so they don't conflict with source editors. */
  scriptId: string;
  /** Live-compiled JavaScript output (updates on every TS keystroke). */
  javascript: string;
  /** Live-compiled CSS output (updates ~400 ms after last SCSS keystroke). */
  css: string;
  /** Whether the drawer panel is currently collapsed to its header-only height. */
  isCollapsed: boolean;
  /** Callback to toggle the panel between collapsed and expanded states. */
  onToggleCollapse: () => void;
};

export function CompiledOutputDrawer({
  scriptId,
  javascript,
  css,
  isCollapsed,
  onToggleCollapse,
}: CompiledOutputDrawerProps) {
  const { uiState, updateUIState } = useGlobalState();
  const activeTab = uiState.outputDrawerActiveTab;

  const onTabChange = (tab: OutputDrawerTab) => {
    updateUIState({ outputDrawerActiveTab: tab });
  };

  return (
    <div className="compiled-output--wrapper">
      <div className="compiled-output--header">
        <div className="compiled-output--header-left">
          <span className="compiled-output--label">{"// output"}</span>
          <div className="compiled-output--tabs" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "javascript"}
              className={`compiled-output--tab${activeTab === "javascript" ? " compiled-output--tab-active" : ""}`}
              onClick={() => onTabChange("javascript")}
            >
              <span className="compiled-output--tab-badge compiled-output--tab-badge-js">
                js
              </span>
              javascript
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "css"}
              className={`compiled-output--tab${activeTab === "css" ? " compiled-output--tab-active" : ""}`}
              onClick={() => onTabChange("css")}
            >
              <span className="compiled-output--tab-badge compiled-output--tab-badge-css">
                css
              </span>
              css
            </button>
          </div>
        </div>
        <IconButton
          icon={isCollapsed ? ChevronsUp : ChevronsDown}
          variant="secondary"
          size="sm"
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand output" : "Collapse output"}
        />
      </div>
      {!isCollapsed && (
        <div className="compiled-output--body">
          <CodeEditor
            modelId={`${activeTab}-compiled-${scriptId}`}
            language={activeTab === "javascript" ? "typescript" : "scss"}
            contents={activeTab === "javascript" ? javascript : css}
            editable={false}
            settingsOverride={{ fontSize: 12 }}
          />
        </div>
      )}
    </div>
  );
}
