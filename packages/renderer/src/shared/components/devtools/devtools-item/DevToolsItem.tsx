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
        className="flex w-full cursor-pointer items-center gap-2 rounded-[3px] border-none bg-transparent px-2.5 py-2 text-left font-mono text-base font-medium tracking-[0.02em] text-text-muted transition-colors duration-100 select-none hover:bg-hover-overlay hover:text-foreground"
        onClick={() => setExpanded((prev) => !prev)}
        title={`${name} (devtool)`}
      >
        {icon && <span className="flex shrink-0 items-center">{icon}</span>}
        <span className="flex-1 text-left whitespace-nowrap">{name}</span>
        <span className="shrink-0 text-[10px] text-text-muted-faint">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div
          className="absolute bottom-0 left-[calc(100%+8px)] flex max-h-120 max-w-130 min-w-55 animate-devtools-item-reveal flex-col overflow-hidden rounded-default border border-border bg-surface-raised"
          ref={panelRef}
        >
          {panelTitle && (
            <div className="shrink-0 border-b border-border-subtle px-3.5 py-2.5 text-[10px] font-semibold tracking-[0.06em] text-text-muted-strong uppercase">
              <span className="font-normal text-text-muted-faint">{"// "}</span>
              {panelTitle}
            </div>
          )}
          <div className="scrollbar-thin flex-1 overflow-auto">{panel}</div>
        </div>
      )}
    </div>
  );
}
