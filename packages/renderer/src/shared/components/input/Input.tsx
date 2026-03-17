import { forwardRef, useCallback, useState } from "react";
import clsx from "clsx";

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
      <div className={clsx("relative min-w-0 flex flex-col gap-2", className)}>
        {label && (
          <label className="font-mono text-xs font-normal leading-none text-label-fg uppercase">
            {label}
          </label>
        )}
        <input
          {...props}
          ref={ref}
          type={type}
          className={clsx(
            "w-full box-border font-mono text-base font-normal leading-normal",
            "text-foreground h-(--input-height) px-3 py-1.5",
            "bg-surface-input border border-border rounded-default",
            "transition-colors duration-150",
            "placeholder:text-base placeholder:text-text-muted-faint",
            "hover:border-text-muted",
            "focus:outline-none focus:border-accent-border",
            "focus-visible:outline-none",
            !valid && "border-danger placeholder:text-danger"
          )}
          onBlur={onBlur}
        />
      </div>
    );
  }
);
