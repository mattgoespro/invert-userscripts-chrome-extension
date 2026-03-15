type TabContentProps = {
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export function TabContent({ children, className, ...rest }: TabContentProps) {
  return (
    <div
      role="tabpanel"
      className={`tab-list--content${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}
