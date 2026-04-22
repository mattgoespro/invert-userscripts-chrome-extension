import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import clsx from "clsx";

type UrlPatternInputProps = {
  patterns: string[];
  onChange: (patterns: string[]) => void;
  className?: string;
};

/**
 * Regex for a valid HTTP/HTTPS URL glob pattern.
 * Supports `*` and `?` glob wildcards in host, port, and path segments.
 *
 * Structure: scheme://host[:port][/path]
 * - Scheme: `http`, `https`, or `*`
 * - Host: `*`, `localhost`, or a dotted domain (each label: alphanumeric/glob, no leading/trailing hyphens)
 * - Port: optional, digits or glob wildcards
 * - Path: optional, any non-whitespace
 */
const URL_GLOB_PATTERN =
  /^(\*|https?):\/\/(\*|localhost|(?:[a-zA-Z0-9*?](?:[a-zA-Z0-9\-*?]*[a-zA-Z0-9*?])?\.)+[a-zA-Z0-9*?](?:[a-zA-Z0-9\-*?]*[a-zA-Z0-9*?])?)(?::[0-9*?]+)?(?:\/\S*)?$/;

/**
 * Validates that a glob pattern is a valid HTTP/HTTPS URL glob expression.
 * Mirrors the conversion logic in `packages/runtime/src/ide/scripts.ts`.
 */
function isValidGlob(pattern: string): boolean {
  return URL_GLOB_PATTERN.test(pattern);
}

export function UrlPatternInput({
  patterns,
  onChange,
  className,
}: UrlPatternInputProps) {
  const [expanded, setExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipAreaRef = useRef<HTMLDivElement>(null);

  const count = patterns.length;

  /** Validate all patterns */
  const invalidIndices = useMemo(() => {
    const set = new Set<number>();
    patterns.forEach((p, i) => {
      if (!isValidGlob(p)) {
        set.add(i);
      }
    });
    return set;
  }, [patterns]);

  const invalidCount = invalidIndices.size;

  /** Close panel when clicking outside */
  useEffect(() => {
    if (!expanded) {
      return;
    }
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  /** Close on Escape */
  useEffect(() => {
    if (!expanded) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  /** Clear flash after animation */
  useEffect(() => {
    if (flashIndex === null) {
      return;
    }
    const timer = setTimeout(() => setFlashIndex(null), 600);
    return () => clearTimeout(timer);
  }, [flashIndex]);

  /** Commit input text as new patterns */
  const commitInput = useCallback(() => {
    const candidates = inputValue
      .split(/[,\n]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (candidates.length === 0) {
      return;
    }

    const invalid = candidates.filter((p) => !isValidGlob(p));
    if (invalid.length > 0) {
      setInputError(
        `Invalid pattern: must start with http://, https://, or *://`
      );
      return;
    }

    const existing = new Set(patterns);
    const toAdd: string[] = [];

    for (const p of candidates) {
      if (existing.has(p)) {
        const dupeIndex = patterns.indexOf(p);
        setFlashIndex(dupeIndex);
      } else {
        toAdd.push(p);
        existing.add(p);
      }
    }

    if (toAdd.length > 0) {
      onChange([...patterns, ...toAdd]);
    }

    setInputValue("");
    setInputError(null);
  }, [inputValue, patterns, onChange]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        commitInput();
      } else if (
        event.key === "Backspace" &&
        inputValue === "" &&
        patterns.length > 0
      ) {
        onChange(patterns.slice(0, -1));
      }
    },
    [inputValue, patterns, onChange, commitInput]
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(patterns.filter((_, i) => i !== index));
    },
    [patterns, onChange]
  );

  const handleToggleClick = useCallback(() => {
    setExpanded((prev) => {
      if (!prev) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      return !prev;
    });
  }, []);

  /** Scroll chip area to bottom when patterns change */
  useEffect(() => {
    if (expanded && chipAreaRef.current) {
      chipAreaRef.current.scrollTop = chipAreaRef.current.scrollHeight;
    }
  }, [patterns.length, expanded]);

  const summaryText = useMemo(() => {
    if (count === 0) {
      return null;
    }
    const preview = patterns.slice(0, 2).join(", ");
    const remaining = count - 2;
    return remaining > 0 ? `${preview} +${remaining}` : preview;
  }, [patterns, count]);

  return (
    <div className={clsx("relative", className)} ref={wrapperRef}>
      {/* Toggle bar */}
      <button
        type="button"
        onClick={handleToggleClick}
        className={clsx(
          "flex w-full items-center gap-2",
          "h-(--input-height) rounded-default px-3 py-1.5",
          "font-mono text-base leading-normal font-normal",
          "border bg-surface-input transition-colors duration-150",
          "cursor-pointer select-none",
          "focus-visible:border-accent-border focus-visible:outline-none",
          expanded
            ? "border-accent-border text-foreground"
            : "border-border text-text-muted-strong hover:border-text-muted"
        )}
      >
        <span className="shrink-0 text-xs text-syntax-param">urls:</span>

        {count === 0 ? (
          <span className="flex-1 text-left text-text-muted-faint">
            Add URL patterns...
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-left text-foreground">
            {summaryText}
          </span>
        )}

        <span className="flex shrink-0 items-center gap-1.5">
          {invalidCount > 0 && (
            <span className="text-[10px] text-danger">
              {invalidCount} invalid
            </span>
          )}
          {count > 0 && (
            <span className="text-[10px] text-text-muted-faint">[{count}]</span>
          )}
          <span
            className={clsx(
              "inline-flex text-[10px] text-text-muted-faint",
              "transition-transform duration-200 ease-in-out",
              expanded && "rotate-90 text-accent"
            )}
          >
            ▸
          </span>
        </span>
      </button>

      {/* Dropdown chip panel */}
      {expanded && (
        <div
          className={clsx(
            "absolute top-[calc(100%+6px)] left-0 z-100 w-full",
            "flex flex-col overflow-hidden",
            "rounded-default border border-accent-border bg-surface-panel",
            "shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(0,0,0,0.25)]",
            "animate-panel-enter"
          )}
        >
          {/* Scrollable chip area */}
          <div
            ref={chipAreaRef}
            className={clsx(
              "flex max-h-52 flex-wrap content-start gap-xs overflow-y-auto p-sm",
              "scrollbar-thin"
            )}
          >
            {count === 0 && (
              <span className="w-full py-xs text-center font-mono text-[11px] text-text-muted-faint italic">
                No patterns — script won't match any pages
              </span>
            )}

            {patterns.map((pattern, index) => {
              const isInvalid = invalidIndices.has(index);
              const isFlashing = flashIndex === index;

              return (
                <div
                  key={`${pattern}-${index}`}
                  className={clsx(
                    "url-pattern-chip group inline-flex max-w-full items-center gap-1",
                    "rounded-default px-2 py-px",
                    "font-mono text-[11px] leading-[20px]",
                    "border transition-colors duration-100",
                    isFlashing && "url-pattern-flash",
                    isInvalid
                      ? "border-error-border bg-error-surface text-error-accent"
                      : "border-border bg-surface-raised text-foreground hover:border-text-muted-faint"
                  )}
                >
                  <span className="min-w-0 truncate" title={pattern}>
                    {pattern}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className={clsx(
                      "inline-flex shrink-0 cursor-pointer items-center rounded-sm p-px",
                      "text-text-muted-faint transition-colors duration-100",
                      "opacity-0 group-hover:opacity-100",
                      "hover:text-danger"
                    )}
                    title="Remove"
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pinned input row */}
          <div className="flex items-center border-t border-border-subtle px-sm py-xs">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value);
                if (inputError) {
                  setInputError(null);
                }
              }}
              onKeyDown={handleInputKeyDown}
              onBlur={() => {
                if (inputValue.trim()) {
                  commitInput();
                }
              }}
              placeholder={
                count === 0
                  ? "https://*.example.com/* — Enter to add"
                  : "Add pattern..."
              }
              className={clsx(
                "min-w-24 flex-1 border-none bg-transparent",
                "py-px font-mono text-[11px] leading-[20px] outline-none",
                "placeholder:text-text-muted-faint",
                inputError ? "text-danger" : "text-foreground"
              )}
            />
            {inputError && (
              <span className="shrink-0 font-mono text-[9px] text-danger">
                {inputError}
              </span>
            )}
          </div>

          {/* Footer status */}
          {count > 0 && (
            <div className="flex items-center justify-between border-t border-border-subtle px-sm py-px">
              <span className="font-mono text-[9px] text-text-muted-faint">
                {count} pattern{count !== 1 ? "s" : ""}
                {invalidCount > 0 && (
                  <span className="ml-1 text-danger">
                    · {invalidCount} invalid
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange([]);
                  inputRef.current?.focus();
                }}
                className="cursor-pointer font-mono text-[9px] text-text-muted-faint transition-colors duration-100 hover:text-danger"
              >
                clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
