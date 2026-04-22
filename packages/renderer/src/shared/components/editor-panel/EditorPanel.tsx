import clsx from "clsx";

type EditorPanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function EditorPanel({ children, className }: EditorPanelProps) {
  return (
    <div
      className={clsx(
        "rounded-default border-border bg-surface-base h-full overflow-hidden border shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
        className
      )}
    >
      {children}
    </div>
  );
}
