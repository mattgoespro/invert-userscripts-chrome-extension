import { SidebarTab } from "@shared/model";
import { ClipboardPenIcon, PackageIcon, SettingsIcon } from "lucide-react";
import "./Sidebar.scss";
import { SidebarNavButton } from "./sidebar-nav-button/SidebarNavButton";

/** Alias for {@link SidebarTab} — kept for backwards compatibility with existing consumers. */
export type SidebarButton = SidebarTab;

interface SidebarProps {
  active: SidebarButton;
  onNavigate: (tab: SidebarButton) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <div className="sidebar--wrapper">
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
