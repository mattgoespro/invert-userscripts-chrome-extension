import { Command } from "@/shared/command-palette/command.types";
import { CommandPaletteItem } from "./CommandPaletteItem";

interface CommandPaletteResultsProps {
  recentCommands: Command[];
  allCommands: Command[];
  selectedIndex: number;
  onSelect: (command: Command) => void;
  onHover: (index: number) => void;
}

export function CommandPaletteResults({
  recentCommands,
  allCommands,
  selectedIndex,
  onSelect,
  onHover,
}: CommandPaletteResultsProps) {
  const hasRecent = recentCommands.length > 0;
  const hasAll = allCommands.length > 0;

  if (!hasRecent && !hasAll) {
    return (
      <div className="flex items-center px-md py-sm">
        <span className="font-mono text-[12px] text-text-muted-faint">
          No matching commands
        </span>
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Commands"
      className="scrollbar-thin max-h-[min(50vh,420px)] overflow-y-auto py-xs"
    >
      {recentCommands.map((command, index) => (
        <CommandPaletteItem
          key={`recent-${command.id}`}
          command={command}
          selected={index === selectedIndex}
          onSelect={() => onSelect(command)}
          onHover={() => onHover(index)}
        />
      ))}

      {hasRecent && hasAll && (
        <div className="my-xs border-t border-border" role="separator" />
      )}

      {allCommands.map((command, index) => {
        const flatIndex = recentCommands.length + index;
        return (
          <CommandPaletteItem
            key={`all-${command.id}`}
            command={command}
            selected={flatIndex === selectedIndex}
            onSelect={() => onSelect(command)}
            onHover={() => onHover(flatIndex)}
          />
        );
      })}
    </div>
  );
}
