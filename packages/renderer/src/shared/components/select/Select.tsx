import { cva } from "class-variance-authority";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

const selectToggleVariants = cva(
  "flex items-center gap-2 w-full py-2 px-3.5 h-(--input-height) rounded-default cursor-pointer text-base font-medium select-none transition-colors duration-150 focus-visible:outline-none focus-visible:border-accent-border focus-visible:shadow-[0_0_0_3px_var(--accent-subtle)]",
  {
    variants: {
      expanded: {
        true: "bg-surface-raised border border-accent-border text-foreground shadow-[0_0_0_3px_var(--accent-subtle)]",
        false:
          "bg-select-bg border border-select-border text-foreground hover:border-text-muted-faint",
      },
    },
    defaultVariants: {
      expanded: false,
    },
  }
);

const selectOptionVariants = cva(
  "flex items-center gap-2 w-full h-(--button-height) py-0 px-2.5 border-none rounded-[calc(var(--geometry-border-radius)-2px)] cursor-pointer text-base font-medium text-left whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-120 active:bg-active-overlay",
  {
    variants: {
      selected: {
        true: "text-foreground bg-selected",
        false:
          "bg-transparent text-text-muted hover:bg-hover-overlay hover:text-foreground",
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export type SelectOption = {
  value: string;
  label?: string;
};

type SelectProps<T> = {
  options: SelectOption[];
  label?: string;
  value: T;
  onChange: (newValue: T) => void;
};

export function Select<T>({ label, options, value, onChange }: SelectProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedLabel =
    options.find(
      (o) =>
        o.value === (typeof value === "string" ? value : JSON.stringify(value))
    )?.label ??
    options.find(
      (o) =>
        o.value === (typeof value === "string" ? value : JSON.stringify(value))
    )?.value ??
    String(value);

  /** Close when clicking outside */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setExpanded(false);
      }
    }

    if (expanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  /** Close on Escape */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    }

    if (expanded) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  function handleSelect(optionValue: string) {
    onChange(optionValue as T);
    setExpanded(false);
  }

  /** Cycle through options with arrow keys while toggle is focused */
  function handleToggleKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    event.preventDefault();
    const currentIndex = options.findIndex((o) => o.value === stringValue);
    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(currentIndex + 1, options.length - 1)
        : Math.max(currentIndex - 1, 0);

    if (nextIndex !== currentIndex) {
      onChange(options[nextIndex].value as T);
    }
  }

  const stringValue = typeof value === "string" ? value : JSON.stringify(value);

  return (
    <div className="relative flex flex-col gap-2" ref={wrapperRef}>
      {label && (
        <label className="text-xs leading-none font-medium text-label-fg">
          {label}
        </label>
      )}
      <button
        className={selectToggleVariants({ expanded })}
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={handleToggleKeyDown}
      >
        <span className="flex-1 overflow-hidden text-left text-ellipsis whitespace-nowrap">
          {selectedLabel}
        </span>
        <span
          className={clsx(
            "inline-flex shrink-0 text-[10px] text-text-muted-faint",
            "transition-transform duration-250 ease-in-out",
            expanded && "rotate-90 text-accent"
          )}
        >
          ▸
        </span>
      </button>

      {expanded && (
        <div
          className={clsx(
            "absolute top-[calc(100%+6px)] left-0 max-h-70 w-full min-w-45",
            "flex flex-col gap-px rounded-default border border-border bg-surface-raised p-1",
            "z-100 scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent overflow-scroll hover:scrollbar-thumb-hover-overlay",
            "shadow-(--popover-shadow)",
            "origin-top animate-select-reveal"
          )}
        >
          <div>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={selectOptionVariants({
                  selected: option.value === stringValue,
                })}
                onClick={() => handleSelect(option.value)}
              >
                {option.label ?? option.value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
