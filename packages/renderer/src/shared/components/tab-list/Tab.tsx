import { Children, isValidElement } from "react";
import { TabContent } from "./TabContent";
import "./Tab.scss";

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
      className={`tab-list--tab${active ? " tab-list--tab-active" : ""}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {labelChildren}
    </button>
  );
}
