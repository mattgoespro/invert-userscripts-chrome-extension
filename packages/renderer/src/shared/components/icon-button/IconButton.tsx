import {
  ButtonHTMLAttributes,
  createElement,
  forwardRef,
  PropsWithChildren,
} from "react";
import { LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import { iconButtonSizes, iconGlyphSizes } from "../button/presets";

const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center p-0 bg-transparent border border-transparent rounded-default cursor-pointer text-text-muted transition-colors duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  {
    variants: {
      variant: {
        primary: "hover:bg-accent-subtle hover:text-accent",
        secondary: "hover:bg-hover-overlay hover:text-foreground",
        outlined:
          "border-border text-text-muted hover:border-text-muted-faint hover:text-foreground",
        ghost: "hover:bg-hover-overlay hover:text-foreground",
        danger:
          "hover:bg-error-surface hover:border-danger hover:text-error-accent",
      },
      size: iconButtonSizes,
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type IconButtonProps = PropsWithChildren<
  {
    icon: LucideIcon;
  } & VariantProps<typeof iconButtonVariants> &
    ButtonHTMLAttributes<HTMLButtonElement>
>;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      children,
      variant,
      icon,
      size = "md",
      type = "button",
      className,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        {...rest}
        type={type}
        aria-label={rest["aria-label"] ?? rest.title}
        className={clsx(iconButtonVariants({ variant, size }), className)}
      >
        {icon &&
          createElement(icon, {
            size: iconGlyphSizes[size ?? "md"],
            className: "shrink-0",
            "aria-hidden": true,
          })}
        {children}
      </button>
    );
  }
);
