import "./Select.scss";

type SelectProps<T> = {
  options: Array<{ value: string; label?: string }>;
  label?: string;
  value: T;
  onChange: (newValue: T) => void;
};

export function Select<T>({ label, options, value, onChange }: SelectProps<T>) {
  return (
    <div className="select--wrapper">
      {label && <label className="select--label">{label}</label>}
      <select
        className="select--field"
        value={JSON.stringify(value)}
        onChange={(e) => onChange(JSON.parse(e.target.value))}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label ?? option.value}
          </option>
        ))}
      </select>
    </div>
  );
}
