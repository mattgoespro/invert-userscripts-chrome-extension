import './Switch.scss';

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export function Switch({ checked, onChange, disabled = false, label }: SwitchProps) {
  return (
    <label className={`switch ${disabled ? 'switch--disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-slider"></span>
      {label && <span className="switch-label">{label}</span>}
    </label>
  );
}
