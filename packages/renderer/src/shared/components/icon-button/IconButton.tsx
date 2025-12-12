import { ButtonHTMLAttributes, MouseEventHandler, PropsWithChildren } from 'react';
import './IconButton.scss';

type IconButtonProps = PropsWithChildren<
  {
    onClick?: MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    active?: boolean;
  } & ButtonHTMLAttributes<HTMLButtonElement>
>;

export function IconButton({
  children,
  onClick,
  disabled = false,
  active = false,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      className={['icon-btn', active ? 'icon-btn--active' : ''].join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
