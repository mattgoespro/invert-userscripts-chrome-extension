import { Children, isValidElement, type ReactNode } from "react";
import { Tab } from "./Tab";
import { TabContent } from "./TabContent";
import "./TabList.scss";

type TabListProps = {
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export function TabList({ children, className, ...rest }: TabListProps) {
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
    <div className={`tab-list${className ? ` ${className}` : ""}`} {...rest}>
      <div className="tab-list--bar" role="tablist">
        {children}
      </div>
      {activeContent}
    </div>
  );
}
