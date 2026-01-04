import { ClipboardPenIcon, PackageIcon, SettingsIcon } from "lucide-react";
import "./Sidebar.scss";
import { SidebarNavButton } from "./sidebar-nav-button/SidebarNavButton";

export type SidebarButton = "scripts" | "modules" | "settings";

interface SidebarProps {
  active: SidebarButton;
  onNavigate: (tab: SidebarButton) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <div className="sidebar">
      <SidebarNavButton
        icon={ClipboardPenIcon}
        active={active === "scripts"}
        onClick={() => onNavigate("scripts")}
      ></SidebarNavButton>
      <SidebarNavButton
        icon={PackageIcon}
        active={active === "modules"}
        onClick={() => onNavigate("modules")}
      ></SidebarNavButton>
      <SidebarNavButton
        icon={SettingsIcon}
        active={active === "settings"}
        onClick={() => onNavigate("settings")}
      ></SidebarNavButton>
    </div>
  );
}
