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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center border-b border-border px-md">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Command palette search"
        className="h-10 w-full bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-text-muted-faint"
      />
    </div>
  );
}
