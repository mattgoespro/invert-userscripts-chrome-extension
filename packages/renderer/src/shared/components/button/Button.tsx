import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-mono font-medium rounded-default cursor-pointer transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "h-7 px-2 py-0 text-xs",
        md: "px-4 py-1.5 text-sm",
      },
      variant: {
        primary:
          "bg-accent text-surface-base border-none hover:bg-accent-hover",
        secondary:
          "bg-transparent text-secondary border border-secondary enabled:hover:bg-secondary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-secondary",
        danger:
          "bg-error-surface text-error-accent border border-error-border hover:bg-danger hover:border-danger hover:text-foreground",
      },
    },
    defaultVariants: {
      size: "md",
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
  size,
  onClick,
  disabled = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(buttonVariants({ variant, size }), className)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
