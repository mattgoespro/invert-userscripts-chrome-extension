import { JSX } from "react";

export interface TabViewContentProps {
  label: string;
  children: JSX.Element | JSX.Element[];
}

export function TabViewContent(props: TabViewContentProps) {
  return <>{props.children}</>;
}
