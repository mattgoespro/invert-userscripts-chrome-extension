import { Children, isValidElement, type ReactNode } from "react";
import { Tab } from "./Tab";
import { TabContent } from "./TabContent";
import clsx from "clsx";

type TabListProps = {
  children: ReactNode;
  barClassName?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export function TabList({
  children,
  className,
  barClassName,
  ...rest
}: TabListProps) {
  let activeContent: ReactNode = null;

  Children.forEach(children, (child) => {
    if (
      isValidElement<{ active?: boolean; children?: ReactNode }>(child) &&
      child.type === Tab &&
      child.props.active
    ) {
      Children.forEach(child.props.children as ReactNode, (tabChild) => {
        if (isValidElement(tabChild) && tabChild.type === TabContent) {
          activeContent = tabChild;
        }
      });
    }
  });

  return (
    <div className={clsx(className)} {...rest}>
      <div
        className={clsx("gap-md flex items-center", barClassName)}
        role="tablist"
      >
        {children}
      </div>
      {activeContent}
    </div>
  );
}
