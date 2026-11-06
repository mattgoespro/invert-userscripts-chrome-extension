import { Input } from "@/shared/components/input/Input";
import { useState } from "react";
import { parseNumberSetting } from "./number-setting";

type NumberSettingInputProps = {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  className?: string;
};

/**
 * A bounded number setting. The text stays local while it's being edited, since
 * typing passes through out-of-range values on the way to a valid one (clearing
 * "14" to type "20"). Valid values commit as they're typed; leaving the field
 * drops whatever is left and shows the stored value again.
 */
export function NumberSettingInput({
  label,
  value,
  min,
  max,
  onCommit,
  className,
}: NumberSettingInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      type="number"
      label={label}
      value={draft ?? value ?? ""}
      min={min}
      max={max}
      className={className}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = parseNumberSetting(text, min, max);
        if (parsed !== null && parsed !== value) {
          onCommit(parsed);
        }
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
