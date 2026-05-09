import { useGlobalState } from "@/options/invert-ide/contexts/global-state.context";
import { Command } from "@/shared/command-palette/command.types";
import { useRegisterCommands } from "@/shared/hooks/useRegisterCommand";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  setCurrentUserscript,
  selectAllUserscripts,
} from "@/shared/store/slices/userscripts";
import { createUserscript } from "@/shared/store/slices/userscripts/thunks.userscripts";
import { FileCode2, PackageIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { useMemo } from "react";

interface UseRegisterCoreCommandsProps {
  onOpenCommandPalette: () => void;
}

export function useRegisterCoreCommands({
  onOpenCommandPalette,
}: UseRegisterCoreCommandsProps) {
  const dispatch = useAppDispatch();
  const { updateGlobalState } = useGlobalState();
  const scripts = useAppSelector(selectAllUserscripts);

  const commands = useMemo<Command[]>(() => {
    const coreCommands: Command[] = [
      // Navigation
      {
        id: "nav.scripts",
        label: "Go to Scripts",
        category: "navigation",
        icon: FileCode2,
        keywords: ["scripts", "userscripts", "code"],
        shortcut: "Cmd+1",
        action: () => updateGlobalState({ activeSidebarTab: "scripts" }),
      },
      {
        id: "nav.modules",
        label: "Go to Modules",
        category: "navigation",
        icon: PackageIcon,
        keywords: ["modules", "cdn", "libraries"],
        shortcut: "Cmd+2",
        action: () => updateGlobalState({ activeSidebarTab: "modules" }),
      },
      {
        id: "nav.settings",
        label: "Go to Settings",
        category: "navigation",
        icon: Settings2Icon,
        keywords: ["settings", "preferences", "config"],
        shortcut: "Cmd+3",
        action: () => updateGlobalState({ activeSidebarTab: "settings" }),
      },

      // Script operations
      {
        id: "script.create",
        label: "Create New Script",
        category: "script",
        icon: PlusIcon,
        keywords: ["new", "create", "add"],
        shortcut: "Cmd+N",
        action: async () => {
          await dispatch(createUserscript());
        },
      },

      // Command Palette itself
      {
        id: "palette.open",
        label: "Open Command Palette",
        category: "navigation",
        keywords: ["commands", "search", "palette"],
        shortcut: "Cmd+K",
        action: onOpenCommandPalette,
      },
    ];

    // Add quick script switching commands
    const scriptCommands: Command[] = Object.values(scripts).map((script) => ({
      id: `script.open.${script.id}`,
      label: `${script.name}`,
      category: "search" as const,
      keywords: ["script", "open", script.name],
      description: `Open ${script.name}`,
      action: () => {
        dispatch(setCurrentUserscript(script.id));
        updateGlobalState({
          activeSidebarTab: "scripts",
          selectedScriptId: script.id,
        });
      },
    }));

    return [...coreCommands, ...scriptCommands];
  }, [dispatch, updateGlobalState, scripts, onOpenCommandPalette]);

  useRegisterCommands(commands);
}
