import { type ReactNode, useRef, useState } from "react";
import "./DevToolsItem.scss";

type DevToolsItemProps = {
  name: string;
  icon?: ReactNode;
  panel: ReactNode;
  panelTitle?: string;
};

export function DevToolsItem({ name, icon, panel, panelTitle }: DevToolsItemProps) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div className="devtools-item">
      <button
        className="devtools-item--toggle"
        onClick={() => setExpanded((prev) => !prev)}
        title={`${name} (devtool)`}
      >
        {icon && <span className="devtools-item--toggle-icon">{icon}</span>}
        <span className="devtools-item--toggle-label">{name}</span>
        <span className="devtools-item--toggle-chevron">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="devtools-item--panel" ref={panelRef}>
          {panelTitle && (
            <div className="devtools-item--panel-header">
              <span className="devtools-item--panel-prefix">{"// "}</span>
              {panelTitle}
            </div>
          )}
          <div className="devtools-item--panel-content">{panel}</div>
        </div>
      )}
    </div>
  );
}
