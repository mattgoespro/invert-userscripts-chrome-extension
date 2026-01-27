import { forwardRef } from "react";
import "./Input.scss";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, type = "text", className, ...props }, ref) => {
    return (
      <input
        {...props}
        ref={ref}
        className={`input--field ${className ?? ""}`.trim()}
        type={type}
      />
    );
  }
);
