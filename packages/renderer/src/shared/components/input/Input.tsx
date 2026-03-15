import { forwardRef, useCallback, useState } from "react";
import "./Input.scss";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, type = "text", className, ...props },
    ref: React.Ref<HTMLInputElement>
  ) => {
    const [valid, setValid] = useState(true);

    const onBlur = useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (props.required) {
          setValid(event.target.value.trim().length > 0);
        }
        if (props.onBlur) {
          props.onBlur(event);
        }
      },
      [props]
    );
    return (
      <div className={`input--wrapper ${className ?? ""}`.trim()}>
        {label && <label className="input--label">{label}</label>}
        <input
          {...props}
          ref={ref}
          type={type}
          className={`input--field ${!valid ? "input--field--invalid" : ""}`.trim()}
          onBlur={onBlur}
        />
      </div>
    );
  }
);
