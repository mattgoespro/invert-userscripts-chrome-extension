import {
  ButtonHTMLAttributes,
  createElement,
  forwardRef,
  PropsWithChildren,
} from "react";
import { LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

const iconButtonVariants = cva(
  "flex items-center justify-center bg-transparent border border-transparent rounded-default cursor-pointer text-text-muted transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:border-accent-border",
  {
    variants: {
      variant: {
        primary: "hover:bg-accent-subtle hover:text-accent",
        secondary: "hover:bg-hover-overlay hover:text-text-muted-strong",
        outlined:
          "border-border text-text-muted-strong hover:border-accent-muted hover:text-accent",
        ghost: "hover:bg-hover-overlay hover:text-text-muted-strong",
        danger:
          "hover:bg-error-surface hover:border-danger hover:text-error-accent",
      },
      size: {
        sm: "p-1.5",
        md: "p-2",
        lg: "p-1",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

const ICON_SIZES = { sm: 16, md: 24, lg: 32 } as const;

type IconButtonProps = PropsWithChildren<
  {
    icon: LucideIcon;
  } & VariantProps<typeof iconButtonVariants> &
    ButtonHTMLAttributes<HTMLButtonElement>
>;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, variant, icon, size = "md", className, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        {...rest}
        className={clsx(iconButtonVariants({ variant, size }), className)}
      >
        {icon &&
          createElement(icon as React.ElementType, {
            color: "#a5a5a5ff",
            size: ICON_SIZES[size ?? "md"],
          })}
        {children}
      </button>
    );
  }
);
