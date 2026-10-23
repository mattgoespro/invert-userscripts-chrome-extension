import { Command } from "@/shared/command-palette/command.types";
import { useRegisterCommands } from "@/shared/hooks/useRegisterCommand";
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectUserscript } from "@/shared/store/select-userscript";
import { selectEditorSettings } from "@/shared/store/slices/settings";
import { updateSettings } from "@/shared/store/slices/settings/thunks.settings";
import {
  selectAllUserscripts,
  selectCurrentUserscript,
} from "@/shared/store/slices/userscripts";
import {
  createUserscript,
  toggleUserscript,
} from "@/shared/store/slices/userscripts/thunks.userscripts";
import { setActiveSidebarTab } from "@/shared/store/slices/ui";
import { summarizeUrlPatterns } from "@/shared/utils/script-site";
import { AppThemes } from "@shared/constants";
import {
  CommandIcon,
  FileCode2,
  PackageIcon,
  PaletteIcon,
  PlusIcon,
  PowerIcon,
  Settings2Icon,
} from "lucide-react";
import { useMemo } from "react";

interface UseRegisterCoreCommandsProps {
  onOpenCommandPalette: () => void;
}

export function useRegisterCoreCommands({
  onOpenCommandPalette,
}: UseRegisterCoreCommandsProps) {
  const dispatch = useAppDispatch();
  const scripts = useAppSelector(selectAllUserscripts);
  const currentScript = useAppSelector(selectCurrentUserscript);
  const settings = useAppSelector(selectEditorSettings);

  const commands = useMemo<Command[]>(() => {
    const coreCommands: Command[] = [
      {
        id: "nav.scripts",
        label: "Go to Scripts",
        category: "navigation",
        icon: FileCode2,
        keywords: ["scripts", "userscripts", "code"],
        action: () => {
          dispatch(setActiveSidebarTab("scripts"));
        },
      },
      {
        id: "nav.modules",
        label: "Go to Modules",
        category: "navigation",
        icon: PackageIcon,
        keywords: ["modules", "cdn", "libraries"],
        action: () => {
          dispatch(setActiveSidebarTab("modules"));
        },
      },
      {
        id: "nav.settings",
        label: "Go to Settings",
        category: "navigation",
        icon: Settings2Icon,
        keywords: ["settings", "preferences", "config"],
        action: () => {
          dispatch(setActiveSidebarTab("settings"));
        },
      },
      {
        id: "script.create",
        label: "New script",
        category: "script",
        icon: PlusIcon,
        keywords: ["new", "create", "add"],
        action: async () => {
          await dispatch(createUserscript());
        },
      },
      {
        id: "palette.open",
        label: "Open command palette",
        category: "navigation",
        icon: CommandIcon,
        keywords: ["commands", "search", "palette"],
        shortcut: "Ctrl+K",
        action: onOpenCommandPalette,
      },
    ];

    const currentScriptCommands: Command[] = currentScript
      ? [
          {
            id: "script.toggle-current",
            label: `${currentScript.enabled ? "Turn off" : "Turn on"} ${currentScript.name}`,
            category: "script",
            icon: PowerIcon,
            keywords: ["enable", "disable", "toggle", currentScript.name],
            action: async () => {
              await dispatch(toggleUserscript(currentScript.id));
            },
          },
        ]
      : [];

    const themeCommands: Command[] = AppThemes.map((theme) => ({
      id: `settings.theme.${theme.name}`,
      label: `Theme: ${theme.displayName}`,
      category: "settings" as const,
      icon: PaletteIcon,
      keywords: ["theme", "appearance", "color", theme.family],
      description: theme.description,
      when: () => settings.appTheme !== theme.name,
      action: () => {
        dispatch(updateSettings({ appTheme: theme.name }));
      },
    }));

    const scriptCommands: Command[] = Object.values(scripts).map((script) => ({
      id: `script.open.${script.id}`,
      label: `${script.name}`,
      category: "search" as const,
      keywords: ["script", "open", script.name, ...(script.urlPatterns ?? [])],
      description: summarizeUrlPatterns(script.urlPatterns),
      action: () => {
        dispatch(selectUserscript(script.id));
        dispatch(setActiveSidebarTab("scripts"));
      },
    }));

    return [
      ...scriptCommands,
      ...currentScriptCommands,
      ...coreCommands,
      ...themeCommands,
    ];
  }, [
    dispatch,
    scripts,
    currentScript,
    settings.appTheme,
    onOpenCommandPalette,
  ]);

  useRegisterCommands(commands);
}
