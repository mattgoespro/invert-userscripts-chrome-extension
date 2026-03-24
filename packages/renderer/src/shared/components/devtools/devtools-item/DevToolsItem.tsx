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
        className="text-text-muted hover:bg-hover-overlay hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-[3px] border-none bg-transparent px-2.5 py-2 text-left font-mono text-[11px] font-medium tracking-[0.02em] transition-colors duration-100 select-none"
        onClick={() => setExpanded((prev) => !prev)}
        title={`${name} (devtool)`}
      >
        {icon && <span className="flex shrink-0 items-center">{icon}</span>}
        <span className="flex-1 text-left whitespace-nowrap">{name}</span>
        <span className="text-text-muted-faint shrink-0 text-[10px]">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div
          className="bg-surface-raised border-border rounded-default animate-devtools-item-reveal absolute bottom-0 left-[calc(100%+8px)] flex max-h-120 max-w-130 min-w-55 flex-col overflow-hidden border"
          ref={panelRef}
        >
          {panelTitle && (
            <div className="text-text-muted-strong border-border-subtle shrink-0 border-b px-3.5 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase">
              <span className="text-text-muted-faint font-normal">{"// "}</span>
              {panelTitle}
            </div>
          )}
          <div className="scrollbar-thin flex-1 overflow-auto">{panel}</div>
        </div>
      )}
    </div>
  );
}
