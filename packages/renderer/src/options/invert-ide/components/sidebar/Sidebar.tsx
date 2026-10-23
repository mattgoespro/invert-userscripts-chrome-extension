import { AppSidebarTab } from "@shared/storage";
import {
  CommandIcon,
  FileCode2Icon,
  PackageIcon,
  SettingsIcon,
} from "lucide-react";
import { useAppSelector } from "@/shared/store/hooks";
import { selectAllUserscripts } from "@/shared/store/slices/userscripts";
import { selectModules } from "@/shared/store/slices/modules";
import { SidebarNavButton } from "./sidebar-nav-button/SidebarNavButton";

interface SidebarProps {
  active: AppSidebarTab;
  onNavigate: (tab: AppSidebarTab) => void;
  onOpenCommandPalette: () => void;
}

export function Sidebar({
  active,
  onNavigate,
  onOpenCommandPalette,
}: SidebarProps) {
  const scriptCount = useAppSelector(
    (state) => Object.keys(selectAllUserscripts(state) ?? {}).length
  );
  const moduleCount = useAppSelector(
    (state) => Object.keys(selectModules(state) ?? {}).length
  );

  return (
    <nav
      aria-label="Main"
      className="relative flex w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-surface-chrome px-2 pt-md pb-sm max-[1360px]:w-14"
    >
      <p className="px-2.5 pb-md font-heading text-[19px] leading-none font-extrabold tracking-[-0.04em] text-foreground select-none max-[1360px]:px-0 max-[1360px]:text-center">
        <span className="max-[1360px]:hidden">Invert</span>
        <span aria-hidden className="hidden max-[1360px]:inline">
          I
        </span>
      </p>
      <SidebarNavButton
        icon={FileCode2Icon}
        active={active === "scripts"}
        onClick={() => onNavigate("scripts")}
        title="Scripts"
        count={scriptCount}
      />
      <SidebarNavButton
        icon={PackageIcon}
        active={active === "modules"}
        onClick={() => onNavigate("modules")}
        title="Modules"
        count={moduleCount}
      />
      <SidebarNavButton
        icon={SettingsIcon}
        active={active === "settings"}
        onClick={() => onNavigate("settings")}
        title="Settings"
      />
      <div className="flex-1" />
      <button
        type="button"
        onClick={onOpenCommandPalette}
        title="Commands (Ctrl K)"
        className="flex h-8 items-center gap-2 rounded-default px-2.5 text-xs text-text-muted-strong transition-colors duration-150 hover:bg-hover-overlay hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent max-[1360px]:justify-center max-[1360px]:px-0"
      >
        <CommandIcon size={14} aria-hidden />
        <span className="flex-1 text-left max-[1360px]:hidden">Commands</span>
        <kbd className="font-body text-[11px] text-text-muted-faint max-[1360px]:hidden">
          Ctrl K
        </kbd>
      </button>
    </nav>
  );
}
