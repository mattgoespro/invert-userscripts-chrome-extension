import { Children, isValidElement } from "react";
import { TabContent } from "./TabContent";
import { cva } from "class-variance-authority";
import clsx from "clsx";

const tabVariants = cva(
  "inline-flex items-center gap-1.5 py-0.75 px-2.5 rounded-default cursor-pointer font-mono text-base font-medium tracking-[0.03em] transition-colors duration-150",
  {
    variants: {
      active: {
        true: "text-foreground bg-surface-overlay border border-border",
        false:
          "text-text-muted bg-transparent border border-transparent hover:text-foreground hover:bg-hover-overlay",
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

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
      className={clsx(tabVariants({ active }), className)}
      {...rest}
    >
      {labelChildren}
    </button>
  );
}
