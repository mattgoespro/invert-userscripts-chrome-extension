type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
};

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className="switch--wrapper relative inline-block w-9 h-5">
      <input
        className="switch--input opacity-0 w-0 h-0"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch--slider"></span>
      {label && (
        <span className="flex items-center gap-2.5 cursor-pointer font-mono text-[13px] text-text-muted-strong">
          {label}
        </span>
      )}
    </label>
  );
}
