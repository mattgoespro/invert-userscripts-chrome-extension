import { AppSidebarTab } from "@shared/storage";
import { ClipboardPenIcon, PackageIcon, SettingsIcon } from "lucide-react";
import { SidebarNavButton } from "./sidebar-nav-button/SidebarNavButton";

interface SidebarProps {
  active: AppSidebarTab;
  onNavigate: (tab: AppSidebarTab) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <div className="relative flex flex-col items-center gap-1 border-r border-border bg-surface-raised py-sm">
      <SidebarNavButton
        icon={ClipboardPenIcon}
        active={active === "scripts"}
        onClick={() => onNavigate("scripts")}
        title="Scripts"
      ></SidebarNavButton>
      <SidebarNavButton
        icon={PackageIcon}
        active={active === "modules"}
        onClick={() => onNavigate("modules")}
        title="Modules"
      ></SidebarNavButton>
      <SidebarNavButton
        icon={SettingsIcon}
        active={active === "settings"}
        onClick={() => onNavigate("settings")}
        title="Settings"
      ></SidebarNavButton>
    </div>
  );
}
