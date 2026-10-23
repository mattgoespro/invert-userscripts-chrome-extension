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
        "border-r border-border pr-sm tracking-[0.03em] select-none",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
