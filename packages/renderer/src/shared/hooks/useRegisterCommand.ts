import { Command } from "@shared/command-palette";
import { useEffect } from "react";
import { useCommandRegistry } from "../contexts/command-registry.context";

/**
 * Hook to register a command with the Command Palette.
 * Automatically unregisters when component unmounts.
 */
export function useRegisterCommand(command: Command) {
  const { registerCommand, unregisterCommand } = useCommandRegistry();

  useEffect(() => {
    registerCommand(command);
    return () => unregisterCommand(command.id);
  }, [command, registerCommand, unregisterCommand]);
}

/**
 * Hook to register multiple commands at once
 */
export function useRegisterCommands(commands: Command[]) {
  const { registerCommand, unregisterCommand } = useCommandRegistry();

  useEffect(() => {
    commands.forEach((cmd) => registerCommand(cmd));
    return () => commands.forEach((cmd) => unregisterCommand(cmd.id));
  }, [commands, registerCommand, unregisterCommand]);
}
