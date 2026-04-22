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
    <label className="flex cursor-pointer items-center">
      <input
        type="checkbox"
        className="checkbox"
        checked={checked}
        onChange={handleChange}
      />
      {label && (
        <span className="text-text-muted-strong ml-3 font-mono text-[13px] select-none">
          {label}
        </span>
      )}
    </label>
  );
}
