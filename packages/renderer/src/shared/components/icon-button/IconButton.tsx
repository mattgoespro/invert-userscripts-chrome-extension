import { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import './IconButton.scss';

type IconButtonProps = PropsWithChildren<
  {
    onClick?: () => void;
    disabled?: boolean;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>;

export function IconButton({ children, onClick, disabled = false, ...rest }: IconButtonProps) {
  return (
    <button {...rest} className="icon-btn" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
