import { Command } from "@/shared/command-palette/command.types";
import { CommandPaletteStorage } from "@shared/storage";
import fuzzysort from "fuzzysort";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandPaletteInput } from "./CommandPaletteInput";
import { CommandPaletteResults } from "./CommandPaletteResults";
import { useCommandList } from "@/shared/contexts/command-registry.context";
import type { CommandCategory } from "@/shared/command-palette/command.types";
import type { CommandGroup } from "./CommandPaletteResults";

const CATEGORY_ORDER: CommandCategory[] = [
  "search",
  "script",
  "editor",
  "settings",
  "navigation",
];

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  search: "Scripts",
  script: "Actions",
  editor: "Editor",
  settings: "Settings",
  navigation: "Go to",
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { commands } = useCommandList();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommandIds, setRecentCommandIds] = useState<string[]>([]);
  const paletteRef = useRef<HTMLDivElement>(null);

  const commandMap = useMemo(
    () => new Map(commands.map((cmd) => [cmd.id, cmd])),
    [commands]
  );

  useEffect(() => {
    if (open) {
      CommandPaletteStorage.getRecentActions().then(setRecentCommandIds);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  const visibleCommands = useMemo(() => {
    return commands.filter((cmd) => (cmd.when ? cmd.when() : true));
  }, [commands]);

  const { groups, flatResults } = useMemo(() => {
    const ordered = query.trim()
      ? fuzzysort
          .go(query, visibleCommands, {
            keys: ["label", "keywords"],
            limit: 50,
            threshold: -10000,
          })
          .map((result) => result.obj)
      : visibleCommands;

    const recent = query.trim()
      ? []
      : recentCommandIds
          .map((id) => commandMap.get(id))
          .filter((cmd): cmd is Command => cmd !== undefined);

    const resultGroups: CommandGroup[] = [];
    if (recent.length > 0) {
      resultGroups.push({ label: "Recent", commands: recent });
    }
    for (const category of CATEGORY_ORDER) {
      const commandsInCategory = ordered.filter(
        (cmd) => cmd.category === category
      );
      if (commandsInCategory.length > 0) {
        resultGroups.push({
          label: CATEGORY_LABELS[category],
          commands: commandsInCategory,
        });
      }
    }

    return {
      groups: resultGroups,
      flatResults: resultGroups.flatMap((group) => group.commands),
    };
  }, [query, visibleCommands, recentCommandIds, commandMap]);

  const executeCommand = useCallback(
    async (command: Command) => {
      try {
        await command.action();
        await CommandPaletteStorage.recordCommandUsage(command.id);
        onClose();
      } catch (error) {
        console.error("Command execution failed:", error);
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, Math.max(flatResults.length - 1, 0))
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = flatResults[selectedIndex];
        if (selected) {
          executeCommand(selected);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [flatResults, selectedIndex, executeCommand, onClose]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        paletteRef.current &&
        !paletteRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatResults]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-1000 flex animate-fade-in items-start justify-center bg-scrim pt-[12vh]">
      <div
        ref={paletteRef}
        role="dialog"
        aria-label="Command palette"
        className="flex w-full max-w-160 animate-dialog-enter flex-col overflow-hidden rounded-panel border border-border bg-surface-raised shadow-(--dialog-shadow)"
        onKeyDown={handleKeyDown}
      >
        <CommandPaletteInput
          value={query}
          onChange={setQuery}
          placeholder="Search scripts, actions and settings"
        />
        <CommandPaletteResults
          groups={groups}
          selectedIndex={selectedIndex}
          onSelect={executeCommand}
          onHover={setSelectedIndex}
        />
        <div className="flex gap-lg border-t border-border-subtle bg-surface-chrome px-md py-1.5 text-[11px] text-text-muted-strong">
          <span>Enter to run</span>
          <span>Up and Down to move</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
