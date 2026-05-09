import { Command } from "@/shared/command-palette/command.types";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/**
 * Stable mutation methods — only consumed by registration hooks.
 * Splitting this from the commands list ensures that registering a command
 * does NOT re-render components that only need to register (e.g. InvertIde),
 * preventing infinite re-render loops.
 */
interface CommandRegistryContextValue {
  registerCommand: (command: Command) => void;
  unregisterCommand: (commandId: string) => void;
}

/**
 * The live list of registered commands — only consumed by CommandPalette.
 */
interface CommandListContextValue {
  commands: Command[];
}

const CommandRegistryContext = createContext<
  CommandRegistryContextValue | undefined
>(undefined);

const CommandListContext = createContext<CommandListContextValue | undefined>(
  undefined
);

export function useCommandRegistry() {
  const context = useContext(CommandRegistryContext);
  if (!context) {
    throw new Error(
      "useCommandRegistry must be used within CommandRegistryProvider"
    );
  }
  return context;
}

export function useCommandList() {
  const context = useContext(CommandListContext);
  if (!context) {
    throw new Error(
      "useCommandList must be used within CommandRegistryProvider"
    );
  }
  return context;
}

interface CommandRegistryProviderProps {
  children: React.ReactNode;
}

/**
 * Provides a centralized command registry for the Command Palette.
 * Commands can be registered from anywhere in the component tree without
 * triggering re-renders in components that only register (not read) commands.
 */
export function CommandRegistryProvider({
  children,
}: CommandRegistryProviderProps) {
  const [commands, setCommands] = useState<Command[]>([]);

  const registerCommand = useCallback((command: Command) => {
    setCommands((prev) => {
      const filtered = prev.filter((cmd) => cmd.id !== command.id);
      return [...filtered, command];
    });
  }, []);

  const unregisterCommand = useCallback((commandId: string) => {
    setCommands((prev) => prev.filter((cmd) => cmd.id !== commandId));
  }, []);

  const registryValue = useMemo(
    () => ({ registerCommand, unregisterCommand }),
    [registerCommand, unregisterCommand]
  );

  const listValue = useMemo(() => ({ commands }), [commands]);

  return (
    <CommandRegistryContext.Provider value={registryValue}>
      <CommandListContext.Provider value={listValue}>
        {children}
      </CommandListContext.Provider>
    </CommandRegistryContext.Provider>
  );
}
