import { forwardRef } from "react";
import "./Input.scss";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, type = "text", className, ...props }, ref) => {
    return (
      <div className={`input--wrapper ${className ?? ""}`.trim()}>
        {label && <label className="input--label">{label}</label>}
        <input {...props} ref={ref} className="input--field" type={type} />
      </div>
    );
  }
);
