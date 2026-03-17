import { Children, isValidElement } from "react";
import { TabContent } from "./TabContent";
import clsx from "clsx";

type TabProps = {
  active?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Tab({
  active = false,
  children,
  className,
  ...rest
}: TabProps) {
  const labelChildren = Children.toArray(children).filter(
    (child) => !isValidElement(child) || child.type !== TabContent
  );

  return (
    <button
      role="tab"
      aria-selected={active}
      className={clsx(
        "inline-flex items-center gap-1.5 py-[3px] px-2.5",
        "bg-transparent border border-transparent rounded-default",
        "cursor-pointer font-mono text-[11px] font-medium text-text-muted",
        "tracking-[0.03em] transition-colors duration-150",
        "hover:text-foreground hover:bg-hover-overlay",
        active && "text-foreground bg-surface-overlay border-border",
        className
      )}
      {...rest}
    >
      {labelChildren}
    </button>
  );
}
