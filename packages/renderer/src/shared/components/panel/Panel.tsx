import { PropsWithChildren } from "react";
import "./Panel.scss";

type PanelProps = PropsWithChildren<{
  className?: string;
  minWidth?: string;
}> &
  React.HTMLAttributes<HTMLDivElement>;

export function Panel({ className, minWidth, children, style, ...rest }: PanelProps) {
  const mergedStyle = minWidth ? { ...style, minWidth } : style;

  return (
    <div className={`panel ${className ?? ""}`.trim()} style={mergedStyle} {...rest}>
      {children}
    </div>
  );
}

type PanelHeaderProps = PropsWithChildren<{
  icon?: React.ReactNode;
  className?: string;
}>;

export function PanelHeader({ icon, className, children }: PanelHeaderProps) {
  return (
    <div className={`panel--header ${className ?? ""}`.trim()}>
      {icon && <span className="panel--header-icon">{icon}</span>}
      <span className="panel--header-title">{children}</span>
    </div>
  );
}

type PanelSectionProps = PropsWithChildren<{
  className?: string;
}>;

export function PanelSection({ className, children }: PanelSectionProps) {
  return <div className={`panel--section ${className ?? ""}`.trim()}>{children}</div>;
}

export function PanelDivider() {
  return <div className="panel--divider" />;
}
