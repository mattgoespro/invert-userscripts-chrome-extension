import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

interface CommandPaletteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CommandPaletteInput({
  value,
  onChange,
  placeholder,
}: CommandPaletteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when mounted
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="relative flex items-center border-b border-border-subtle bg-surface-raised px-md py-sm">
      <Search size={18} className="text-text-muted-faint" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-md font-mono text-lg text-foreground outline-none placeholder:text-text-muted-faint"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="font-mono text-xs text-text-muted-faint transition-colors hover:text-text-muted"
          type="button"
        >
          esc
        </button>
      )}
    </div>
  );
}
