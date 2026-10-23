import { PropsWithChildren } from "react";
import clsx from "clsx";

type PanelProps = PropsWithChildren<{
  className?: string;
  minWidth?: string;
}> &
  React.HTMLAttributes<HTMLDivElement>;

export function Panel({
  className,
  minWidth,
  children,
  style,
  ...rest
}: PanelProps) {
  const mergedStyle = minWidth ? { ...style, minWidth } : style;

  return (
    <div
      className={clsx(
        "absolute top-[calc(100%+0.5rem)] right-0 z-100",
        "flex flex-col overflow-hidden",
        "rounded-panel border border-border bg-surface-raised",
        "shadow-(--popover-shadow)",
        "text-xs leading-[1.4]",
        "animate-panel-enter",
        className
      )}
      style={mergedStyle}
      {...rest}
    >
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
    <div
      className={clsx(
        "flex items-center gap-sm px-md py-sm",
        "border-b border-border-subtle",
        className
      )}
    >
      {icon && (
        <span className="flex items-center text-text-muted-faint">{icon}</span>
      )}
      <span className="text-xs font-semibold text-foreground">{children}</span>
    </div>
  );
}

type PanelSectionProps = PropsWithChildren<{
  className?: string;
}>;

export function PanelSection({ className, children }: PanelSectionProps) {
  return (
    <div className={clsx("flex flex-col gap-md p-md", className)}>
      {children}
    </div>
  );
}

export function PanelDivider() {
  return <div className="h-px bg-border-subtle" />;
}
