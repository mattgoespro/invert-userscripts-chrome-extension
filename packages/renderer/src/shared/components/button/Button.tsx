import './Button.scss';

type ButtonProps = {
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = 'primary',
  onClick,
  disabled = false,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
