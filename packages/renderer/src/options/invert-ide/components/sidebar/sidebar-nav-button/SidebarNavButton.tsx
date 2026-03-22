import { createElement } from "react";
import { LucideIcon } from "lucide-react";
import clsx from "clsx";

type SidebarNavButtonProps = {
  icon: LucideIcon;
  onClick: () => void;
  active?: boolean;
};

export function SidebarNavButton({
  icon,
  onClick,
  active = false,
}: SidebarNavButtonProps) {
  return (
    <button
      className={clsx(
        "flex items-center justify-center w-9 h-9 rounded-lg relative",
        "cursor-pointer transition-[background-color,color] duration-150",
        active
          ? "bg-accent-subtle text-accent border-0 border-l-[3px] border-l-accent hover:bg-accent-muted"
          : "bg-transparent border-0 text-text-muted hover:bg-hover-overlay hover:text-text-muted-strong"
      )}
      onClick={onClick}
    >
      {createElement(icon as React.ElementType, { size: 20 })}
    </button>
  );
}
