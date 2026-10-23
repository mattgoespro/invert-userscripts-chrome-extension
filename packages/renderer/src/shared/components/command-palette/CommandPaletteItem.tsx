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
            "rounded-[3px] border px-1.5 py-0.5 text-[11px] leading-none",
            selected
              ? "border-text-muted-faint text-foreground"
              : "border-border text-text-muted-strong"
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
        "flex h-8 cursor-pointer items-center gap-sm border-l-2 px-md text-base transition-colors",
        selected
          ? "border-l-accent bg-selected text-foreground"
          : "border-l-transparent text-text-muted hover:bg-hover-overlay"
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      {Icon ? (
        <Icon
          size={14}
          className={clsx(
            "shrink-0",
            selected ? "text-foreground" : "text-text-muted-strong"
          )}
        />
      ) : (
        <span className="w-3.5 shrink-0" />
      )}

      <span className="min-w-0 flex-1 truncate">{command.label}</span>

      {command.description && (
        <span className="max-w-[45%] shrink-0 truncate font-mono text-[11px] text-text-muted-strong">
          {command.description}
        </span>
      )}

      {command.shortcut && (
        <ShortcutKeys shortcut={command.shortcut} selected={selected} />
      )}
    </div>
  );
}
