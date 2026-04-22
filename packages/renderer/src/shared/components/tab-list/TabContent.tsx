import clsx from "clsx";

type TabContentProps = {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export function TabContent({ children, className, ...rest }: TabContentProps) {
  return (
    <div
      role="tabpanel"
      className={clsx("min-h-0 flex-1 overflow-hidden", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
