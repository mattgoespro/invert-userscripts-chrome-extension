type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
};

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className="switch--wrapper relative inline-block h-5 w-9">
      <input
        className="switch--input h-0 w-0 opacity-0"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch--slider"></span>
      {label && (
        <span className="text-text-muted-strong flex cursor-pointer items-center gap-2.5 font-mono text-[13px]">
          {label}
        </span>
      )}
    </label>
  );
}
