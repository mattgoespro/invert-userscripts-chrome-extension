import "./Switch.scss";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
};

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className={[`switch--wrapper`].join(" ")}>
      <input
        className="switch--input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch--slider"></span>
      {label && <span className="switch--label">{label}</span>}
    </label>
  );
}
