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
        "rounded-default border border-accent-border bg-surface-panel",
        "shadow-[0_4px_24px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,0,0,0.2)]",
        "font-mono text-xs leading-[1.4]",
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
      <span className="font-mono text-[10px] font-semibold tracking-[0.06em] text-text-muted-strong uppercase">
        {children}
      </span>
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
