import {
  ButtonHTMLAttributes,
  createElement,
  forwardRef,
  PropsWithChildren,
} from "react";
import { LucideIcon } from "lucide-react";
import clsx from "clsx";

type IconButtonProps = PropsWithChildren<
  {
    variant?: "primary" | "secondary" | "outlined" | "ghost" | "danger";
    icon: LucideIcon;
    size?: "sm" | "md" | "lg";
  } & ButtonHTMLAttributes<HTMLButtonElement>
>;

const VARIANT_CLASSES = {
  primary: "hover:bg-accent-subtle hover:text-accent",
  secondary: "hover:bg-hover-overlay hover:text-text-muted-strong",
  outlined:
    "border-border text-text-muted-strong hover:border-accent-muted hover:text-accent",
  ghost: "hover:bg-hover-overlay hover:text-text-muted-strong",
  danger: "hover:bg-error-surface hover:border-danger hover:text-error-accent",
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { children, variant = "primary", icon, size = "md", className, ...rest },
    ref
  ) => {
    const getIconStyle = () => {
      switch (size) {
        case "sm":
          return { size: 16, padding: "6px" };
        case "md":
          return { size: 24, padding: "8px" };
        case "lg":
          return { size: 32, padding: "4px" };
      }
    };

    return (
      <button
        style={getIconStyle()}
        ref={ref}
        {...rest}
        className={clsx(
          "flex items-center justify-center bg-transparent border border-transparent",
          "rounded-default cursor-pointer text-text-muted",
          "transition-colors duration-150",
          "active:scale-95 focus-visible:outline-none focus-visible:border-accent-border",
          VARIANT_CLASSES[variant],
          className
        )}
      >
        {icon &&
          createElement(icon as React.ElementType, {
            color: "#a5a5a5ff",
            size: getIconStyle().size,
          })}
        {children}
      </button>
    );
  }
);
