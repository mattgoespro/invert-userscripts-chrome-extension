import './Input.scss';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  onChange: (newValue: string) => void;
};

export function Input({ label, value, placeholder, type = 'text', onChange }: InputProps) {
  return (
    <div className="input-wrapper">
      <label className="input-label">{label}</label>
      <input
        className="input-field"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
