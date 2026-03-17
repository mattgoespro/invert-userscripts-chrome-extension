import clsx from "clsx";

type TabContentProps = {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export function TabContent({ children, className, ...rest }: TabContentProps) {
  return (
    <div
      role="tabpanel"
      className={clsx("flex-1 min-h-0 overflow-hidden", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
