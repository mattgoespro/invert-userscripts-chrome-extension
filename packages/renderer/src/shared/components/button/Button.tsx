import clsx from "clsx";

type ButtonProps = {
  variant?: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const VARIANT_CLASSES = {
  primary: "bg-accent text-surface-base border-none hover:bg-accent-hover",
  secondary:
    "bg-surface-overlay text-text-muted-strong border border-border hover:bg-hover-overlay hover:border-accent-muted",
} as const;

export function Button({
  variant = "primary",
  onClick,
  disabled = false,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-mono text-sm font-medium",
        "py-1.5 px-4 rounded-default cursor-pointer transition-colors duration-150",
        "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant]
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
