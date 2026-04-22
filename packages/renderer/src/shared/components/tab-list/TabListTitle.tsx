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
        "text-text-muted font-mono text-(length:--typography-label-font-size)",
        "pr-sm border-border border-r tracking-[0.03em] select-none",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
