import { type ReactNode, useRef, useState } from "react";

type DevToolsItemProps = {
  name: string;
  icon?: ReactNode;
  panel: ReactNode;
  panelTitle?: string;
};

export function DevToolsItem({
  name,
  icon,
  panel,
  panelTitle,
}: DevToolsItemProps) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative font-mono">
      <button
        className="flex items-center gap-2 w-full py-2 px-2.5 bg-transparent border-none rounded-[3px] text-text-muted cursor-pointer font-mono text-[11px] font-medium tracking-[0.02em] text-left transition-colors duration-100 select-none hover:bg-hover-overlay hover:text-foreground"
        onClick={() => setExpanded((prev) => !prev)}
        title={`${name} (devtool)`}
      >
        {icon && <span className="flex items-center shrink-0">{icon}</span>}
        <span className="whitespace-nowrap flex-1 text-left">{name}</span>
        <span className="text-[10px] text-text-muted-faint shrink-0">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div
          className="absolute bottom-0 left-[calc(100%+8px)] min-w-55 max-w-130 max-h-120 flex flex-col bg-surface-raised border border-border rounded-default overflow-hidden animate-devtools-item-reveal"
          ref={panelRef}
        >
          {panelTitle && (
            <div className="px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted-strong border-b border-border-subtle shrink-0">
              <span className="text-text-muted-faint font-normal">{"// "}</span>
              {panelTitle}
            </div>
          )}
          <div className="overflow-auto flex-1 scrollbar-thin">{panel}</div>
        </div>
      )}
    </div>
  );
}
