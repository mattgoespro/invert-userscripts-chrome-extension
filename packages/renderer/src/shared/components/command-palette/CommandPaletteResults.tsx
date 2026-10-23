import { Command } from "@/shared/command-palette/command.types";
import { CommandPaletteItem } from "./CommandPaletteItem";

export interface CommandGroup {
  label: string;
  commands: Command[];
}

interface CommandPaletteResultsProps {
  groups: CommandGroup[];
  selectedIndex: number;
  onSelect: (command: Command) => void;
  onHover: (index: number) => void;
}

export function CommandPaletteResults({
  groups,
  selectedIndex,
  onSelect,
  onHover,
}: CommandPaletteResultsProps) {
  if (groups.length === 0) {
    return (
      <div className="flex items-center px-md py-md">
        <span className="text-base text-text-muted">
          Nothing matches. Try a script name, a site or an action.
        </span>
      </div>
    );
  }

  let flatIndex = 0;

  return (
    <div
      role="listbox"
      aria-label="Commands"
      className="scrollbar-thin max-h-[min(55vh,460px)] overflow-y-auto pb-xs"
    >
      {groups.map((group) => (
        <div key={group.label} role="group" aria-label={group.label}>
          <div className="px-md pt-sm pb-1 text-xs font-medium text-text-muted-strong">
            {group.label}
          </div>
          {group.commands.map((command) => {
            const index = flatIndex++;
            return (
              <CommandPaletteItem
                key={`${group.label}-${command.id}`}
                command={command}
                selected={index === selectedIndex}
                onSelect={() => onSelect(command)}
                onHover={() => onHover(index)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
