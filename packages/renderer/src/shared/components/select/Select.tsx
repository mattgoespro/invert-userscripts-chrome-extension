import { useEffect, useRef, useState } from "react";
import "./Select.scss";

type SelectOption = {
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
    options.find((o) => o.value === (typeof value === "string" ? value : JSON.stringify(value)))
      ?.label ??
    options.find((o) => o.value === (typeof value === "string" ? value : JSON.stringify(value)))
      ?.value ??
    String(value);

  /** Close when clicking outside */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
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
    <div className="select--wrapper" ref={wrapperRef}>
      {label && <label className="select--label">{label}</label>}
      <button
        className={`select--toggle ${expanded ? "select--toggle-expanded" : ""}`}
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={handleToggleKeyDown}
      >
        <span className="select--toggle-value">{selectedLabel}</span>
        <span className={`select--toggle-chevron ${expanded ? "select--toggle-chevron-open" : ""}`}>
          ▸
        </span>
      </button>

      {expanded && (
        <div className="select--panel">
          <div className="select--panel-content">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`select--option ${option.value === stringValue ? "select--option-active" : ""}`}
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
