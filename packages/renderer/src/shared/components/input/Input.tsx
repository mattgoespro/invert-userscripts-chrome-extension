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
      <div className={clsx("relative flex min-w-0 flex-col gap-2", className)}>
        {label && (
          <label className="text-xs leading-none font-medium text-label-fg">
            {label}
          </label>
        )}
        <input
          {...props}
          ref={ref}
          type={type}
          className={clsx(
            "box-border w-full text-base leading-normal font-normal",
            "h-(--input-height) px-3 py-1.5 text-foreground",
            "rounded-default border border-border bg-surface-input",
            "transition-colors duration-150",
            "placeholder:text-base placeholder:text-text-muted-faint",
            "hover:border-text-muted",
            "focus:border-accent-border focus:shadow-[0_0_0_3px_var(--accent-subtle)] focus:outline-none",
            "focus-visible:outline-none",
            !valid && "border-danger placeholder:text-danger"
          )}
          onBlur={onBlur}
        />
      </div>
    );
  }
);
