import { createElement } from "react";
import { LucideIcon } from "lucide-react";
import { cva } from "class-variance-authority";

const sidebarNavButtonVariants = cva(
  "flex items-center justify-center w-9 h-9 rounded-lg relative cursor-pointer transition-[background-color,color] duration-150",
  {
    variants: {
      active: {
        true: "bg-accent-subtle text-accent border-0 border-l-[3px] border-l-accent hover:bg-accent-muted",
        false:
          "bg-transparent border-0 text-text-muted hover:bg-hover-overlay hover:text-text-muted-strong",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

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
    <button className={sidebarNavButtonVariants({ active })} onClick={onClick}>
      {createElement(icon as React.ElementType, { size: 20 })}
    </button>
  );
}
