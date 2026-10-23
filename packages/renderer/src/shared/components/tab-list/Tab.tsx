import { Children, isValidElement } from "react";
import { TabContent } from "./TabContent";
import { cva } from "class-variance-authority";
import clsx from "clsx";

const tabVariants = cva(
  "relative inline-flex h-full items-center gap-1.5 py-0 px-1 cursor-pointer text-base font-medium transition-colors duration-150 border-y-2 border-transparent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      active: {
        true: "text-foreground border-b-accent",
        false: "text-text-muted hover:text-foreground",
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
      type="button"
      role="tab"
      aria-selected={active}
      className={clsx(tabVariants({ active }), className)}
      {...rest}
    >
      {labelChildren}
    </button>
  );
}
