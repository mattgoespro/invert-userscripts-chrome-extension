import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-mono text-sm font-medium py-1.5 px-4 rounded-default cursor-pointer transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-surface-base border-none hover:bg-accent-hover",
        secondary:
          "bg-surface-overlay text-text-muted-strong border border-border hover:bg-hover-overlay hover:border-accent-muted",
        danger:
          "bg-error-surface text-error-accent border border-error-border hover:bg-danger hover:border-danger hover:text-foreground",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

type ButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
} & VariantProps<typeof buttonVariants> &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">;

export function Button({
  variant,
  onClick,
  disabled = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(buttonVariants({ variant }), className)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
