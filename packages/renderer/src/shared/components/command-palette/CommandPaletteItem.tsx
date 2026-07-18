import { Command } from "@/shared/command-palette/command.types";
import clsx from "clsx";
import { useEffect, useRef } from "react";

interface CommandPaletteItemProps {
  command: Command;
  selected: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function ShortcutKeys({
  shortcut,
  selected,
}: {
  shortcut: string;
  selected: boolean;
}) {
  const keys = shortcut.split("+");

  return (
    <span className="ml-md flex shrink-0 items-center gap-2xs">
      {keys.map((key) => (
        <kbd
          key={key}
          className={clsx(
            "rounded-[3px] border px-1.5 py-px font-mono text-[11px] leading-none",
            selected
              ? "border-accent-border bg-accent/15 text-foreground"
              : "border-border bg-surface-input text-text-muted-faint"
          )}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

export function CommandPaletteItem({
  command,
  selected,
  onSelect,
  onHover,
}: CommandPaletteItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      itemRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  const Icon = command.icon;

  return (
    <div
      ref={itemRef}
      role="option"
      aria-selected={selected}
      className={clsx(
        "flex h-7 cursor-pointer items-center gap-sm px-md font-mono text-[12px] transition-colors",
        selected
          ? "bg-accent/20 text-foreground"
          : "text-text-muted hover:bg-hover-overlay"
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      {Icon ? (
        <Icon
          size={14}
          className={clsx(
            "shrink-0",
            selected ? "text-foreground" : "text-text-muted-faint"
          )}
        />
      ) : (
        <span className="w-3.5 shrink-0" />
      )}

      <span className="min-w-0 flex-1 truncate">{command.label}</span>

      {command.shortcut && (
        <ShortcutKeys shortcut={command.shortcut} selected={selected} />
      )}
    </div>
  );
}
