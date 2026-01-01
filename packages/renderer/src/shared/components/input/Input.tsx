import "./Input.scss";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ label, type = "text", className, ...props }: InputProps) {
  return (
    <div className="input--wrapper">
      {label && <label className="input--label">{label}</label>}
      <input {...props} className={`input--field ${className ?? ""}`.trim()} type={type} />
    </div>
  );
}
