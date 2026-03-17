type CheckboxProps = {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <label className="flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="checkbox"
        checked={checked}
        onChange={handleChange}
      />
      {label && (
        <span className="font-mono text-[13px] text-text-muted-strong ml-3 select-none">
          {label}
        </span>
      )}
    </label>
  );
}
