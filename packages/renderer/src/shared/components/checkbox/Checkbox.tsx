import './Checkbox.scss';

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <label className="checkbox-wrapper">
      <input type="checkbox" className="checkbox" checked={checked} onChange={handleChange} />
      <span className="checkbox-label">{label}</span>
    </label>
  );
}
