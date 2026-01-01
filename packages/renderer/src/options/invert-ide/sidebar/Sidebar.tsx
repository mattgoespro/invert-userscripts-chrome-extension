import { ClipboardPenIcon, PackageIcon, SettingsIcon } from "lucide-react";
import { IconButton } from "../../../shared/components/icon-button/IconButton";
import "./Sidebar.scss";

export type SidebarButton = "scripts" | "modules" | "settings";

interface SidebarProps {
  active: SidebarButton;
  onNavigate: (tab: SidebarButton) => void;
}

export function Sidebar({ active: active, onNavigate }: SidebarProps) {
  return (
    <div className="sidebar">
      <IconButton
        className={[active === "scripts" ? "sidebar--button-active" : null, "sidebar--button"]
          .filter(Boolean)
          .join(" ")}
        icon={ClipboardPenIcon}
        size="md"
        onClick={() => onNavigate("scripts")}
      ></IconButton>
      <IconButton
        icon={PackageIcon}
        className={[active === "modules" ? "sidebar--button-active" : null, "sidebar--button"]
          .filter(Boolean)
          .join(" ")}
        size="md"
        onClick={() => onNavigate("modules")}
      />
      <IconButton
        icon={SettingsIcon}
        className={[active === "settings" ? "sidebar--button-active" : null, "sidebar--button"]
          .filter(Boolean)
          .join(" ")}
        size="md"
        onClick={() => onNavigate("settings")}
      />
    </div>
  );
}
