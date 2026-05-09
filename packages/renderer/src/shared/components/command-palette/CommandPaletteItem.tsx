import { Command } from "@/shared/command-palette/command.types";
import clsx from "clsx";
import { useEffect, useRef } from "react";

interface CommandPaletteItemProps {
  command: Command;
  selected: boolean;
  index: number;
  onSelect: () => void;
  onHover: () => void;
}

export function CommandPaletteItem({
  command,
  selected,
  index,
  onSelect,
  onHover,
}: CommandPaletteItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);

  // Scroll into view when selected
  useEffect(() => {
    if (selected) {
      itemRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  const Icon = command.icon;

  return (
    <div
      ref={itemRef}
      className={clsx(
        "flex cursor-pointer items-center gap-md px-md py-sm font-mono text-sm transition-colors",
        selected
          ? "bg-accent-subtle text-accent"
          : "text-text-muted-strong hover:bg-hover-overlay"
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      {/* Quick-select number (1-9) */}
      {index < 9 && (
        <span
          className={clsx(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold",
            selected
              ? "bg-accent text-surface-base"
              : "bg-surface-input text-text-muted-faint"
          )}
        >
          {index + 1}
        </span>
      )}

      {/* Icon */}
      {Icon && (
        <Icon
          size={16}
          className={selected ? "text-accent" : "text-text-muted"}
        />
      )}

      {/* Label */}
      <span className="flex-1">{command.label}</span>

      {/* Keyboard shortcut */}
      {command.shortcut && (
        <span
          className={clsx(
            "text-xs",
            selected ? "text-accent-muted" : "text-text-muted-faint"
          )}
        >
          {command.shortcut}
        </span>
      )}
    </div>
  );
}
