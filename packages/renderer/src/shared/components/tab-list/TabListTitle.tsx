import "./TabListTitle.scss";

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
      className={`tab-list--title${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </span>
  );
}
