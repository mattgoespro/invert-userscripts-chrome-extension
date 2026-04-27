import { Command } from "@shared/command-palette";
import { CommandPaletteStorage } from "@shared/storage";
import fuzzysort from "fuzzysort";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandPaletteInput } from "./CommandPaletteInput";
import { CommandPaletteResults } from "./CommandPaletteResults";
import { useCommandList } from "@/shared/contexts/command-registry.context";

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

  // Build a stable ID → Command map for recent-command lookups
  const commandMap = useMemo(
    () => new Map(commands.map((cmd) => [cmd.id, cmd])),
    [commands]
  );

  // Load recent commands on mount
  useEffect(() => {
    if (open) {
      CommandPaletteStorage.getRecentActions().then(setRecentCommandIds);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Filter visible commands (check `when` condition)
  const visibleCommands = useMemo(() => {
    return commands.filter((cmd) => (cmd.when ? cmd.when() : true));
  }, [commands]);

  // Fuzzy search results
  const searchResults = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands when no query
      return recentCommandIds
        .map((id) => commandMap.get(id))
        .filter((cmd): cmd is Command => cmd !== undefined);
    }

    // Fuzzy search with fuzzysort
    const results = fuzzysort.go(query, visibleCommands, {
      keys: ["label", "keywords"],
      limit: 50,
      threshold: -10000,
    });

    return results.map((result) => result.obj);
  }, [query, visibleCommands, recentCommandIds, commandMap]);

  // Handle command execution
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

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, searchResults.length - 1)
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = searchResults[selectedIndex];
        if (selected) {
          executeCommand(selected);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key >= "1" && e.key <= "9") {
        const index = parseInt(e.key) - 1;
        if (index < searchResults.length) {
          e.preventDefault();
          executeCommand(searchResults[index]);
        }
      }
    },
    [searchResults, selectedIndex, executeCommand, onClose]
  );

  // Click outside to close
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

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  if (!open) {
    return null;
  }

  return (
    <div className="backdrop-blur-sm fixed inset-0 z-1000 flex animate-fade-in items-start justify-center bg-[rgba(0,0,0,0.5)] pt-[20vh]">
      <div
        ref={paletteRef}
        className="shadow-2xl w-full max-w-2xl overflow-hidden rounded-default border border-accent-border bg-surface-overlay"
        onKeyDown={handleKeyDown}
      >
        <CommandPaletteInput
          value={query}
          onChange={setQuery}
          placeholder="Search commands, scripts, or content..."
        />
        <CommandPaletteResults
          results={searchResults}
          selectedIndex={selectedIndex}
          onSelect={executeCommand}
          onHover={setSelectedIndex}
          showRecent={!query.trim()}
        />
      </div>
    </div>
  );
}
