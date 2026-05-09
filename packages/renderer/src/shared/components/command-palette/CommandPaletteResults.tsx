import { Command } from "@/shared/command-palette/command.types";
import { CommandPaletteItem } from "./CommandPaletteItem";

interface CommandPaletteResultsProps {
  results: Command[];
  selectedIndex: number;
  onSelect: (command: Command) => void;
  onHover: (index: number) => void;
  showRecent: boolean;
}

export function CommandPaletteResults({
  results,
  selectedIndex,
  onSelect,
  onHover,
  showRecent,
}: CommandPaletteResultsProps) {
  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center p-2xl">
        <span className="font-mono text-sm text-text-muted-faint">
          No commands found
        </span>
      </div>
    );
  }

  return (
    <div className="scrollbar-thin max-h-[60vh] overflow-y-auto">
      {showRecent && results.length > 0 && (
        <div className="px-md pt-sm pb-xs">
          <span className="tracking-wide font-mono text-xs text-text-muted-faint uppercase">
            // Recent
          </span>
        </div>
      )}
      <div className="py-xs">
        {results.map((command, index) => (
          <CommandPaletteItem
            key={command.id}
            command={command}
            selected={index === selectedIndex}
            index={index}
            onSelect={() => onSelect(command)}
            onHover={() => onHover(index)}
          />
        ))}
      </div>
    </div>
  );
}
