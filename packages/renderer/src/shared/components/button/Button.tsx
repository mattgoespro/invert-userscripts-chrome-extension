import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import { buttonSizes } from "./presets";

const buttonVariants = cva(
  "inline-flex max-w-full shrink-0 items-center justify-center gap-2 overflow-hidden py-0 font-mono font-medium leading-none whitespace-nowrap rounded-default cursor-pointer transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      size: buttonSizes,
      fullWidth: { true: "w-full", false: "w-fit" },
      variant: {
        link: "bg-transparent border-none text-secondary enabled:hover:underline focus-visible:outline-secondary",
        primary:
          "bg-accent text-surface-base border-none hover:bg-accent-hover",
        secondary:
          "bg-transparent text-secondary border border-secondary enabled:hover:bg-secondary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-secondary",
        danger:
          "bg-error-surface text-error-accent border border-error-border hover:bg-danger hover:border-danger hover:text-foreground",
        ghost:
          "bg-transparent text-text-muted border border-transparent enabled:hover:bg-hover-overlay enabled:hover:text-foreground",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "primary",
      fullWidth: false,
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
  fullWidth,
  type = "button",
  onClick,
  disabled = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={clsx(buttonVariants({ variant, size, fullWidth }), className)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
