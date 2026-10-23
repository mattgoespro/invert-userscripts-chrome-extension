import { createElement } from "react";
import { LucideIcon } from "lucide-react";
import { cva } from "class-variance-authority";

const sidebarNavButtonVariants = cva(
  "flex h-9 w-full items-center gap-2.5 rounded-default px-2.5 text-left cursor-pointer max-[1360px]:justify-center max-[1360px]:px-0 transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      active: {
        true: "bg-selected text-foreground font-semibold",
        false:
          "bg-transparent text-text-muted hover:bg-hover-overlay hover:text-foreground",
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
  title: string;
  count?: number;
};

export function SidebarNavButton({
  icon,
  onClick,
  active = false,
  title,
  count,
}: SidebarNavButtonProps) {
  return (
    <button
      type="button"
      className={sidebarNavButtonVariants({ active })}
      onClick={onClick}
      title={title}
      aria-current={active ? "page" : undefined}
    >
      {createElement(icon, {
        size: 16,
        className: "shrink-0",
        "aria-hidden": true,
      })}
      <span className="min-w-0 flex-1 truncate text-base max-[1360px]:sr-only">
        {title}
      </span>
      {count !== undefined && (
        <span className="shrink-0 text-xs font-normal text-text-muted-strong tabular-nums max-[1360px]:hidden">
          {count}
        </span>
      )}
    </button>
  );
}
