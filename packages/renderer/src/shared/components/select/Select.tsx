import "./Select.scss";

type SelectProps = {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (newValue: string) => void;
};

export function Select({ label, options, value, onChange }: SelectProps) {
  return (
    <div className="select-wrapper">
      <label className="select-label">{label}</label>
      <select className="select-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
