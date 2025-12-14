import './Input.scss';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function Input({ label, type = 'text', ...props }: InputProps) {
  return (
    <div className="input-wrapper">
      <label className="input-label">{label}</label>
      <input className="input-field" type={type} {...props} />
    </div>
  );
}
