import clsx from "clsx";

type TabListTitleProps = {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>;

export function TabListTitle({
  children,
  className,
  ...rest
}: TabListTitleProps) {
  return (
    <span
      className={clsx(
        "font-mono text-(length:--typography-label-font-size) text-text-muted",
        "tracking-[0.03em] select-none pr-sm border-r border-border",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
