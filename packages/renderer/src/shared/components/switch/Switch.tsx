import './Switch.scss';

type SwitchProps = {
  checked: boolean;
  onChange: (newChecked: boolean) => void;
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
        onChange={(event) => {
          event.preventDefault();
          onChange(event.target.checked);
        }}
      />
      <span className="switch-slider"></span>
      {label && <span className="switch-label">{label}</span>}
    </label>
  );
}
