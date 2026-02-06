import { LucideIcon } from "lucide-react";
import { IconButton } from "@/shared/components/icon-button/IconButton";
import "./SidebarNavButton.scss";

type SidebarNavButtonProps = {
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
};

export function SidebarNavButton({ icon, onClick, active = false }: SidebarNavButtonProps) {
  return (
    <IconButton
      className={[active ? "sidebar-nav-button--button-active" : null, "sidebar-nav-button--button"]
        .filter(Boolean)
        .join(" ")}
      icon={icon}
      size="md"
      onClick={onClick}
    />
  );
}
