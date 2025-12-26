import { ButtonHTMLAttributes, createElement, forwardRef, PropsWithChildren } from 'react';
import './IconButton.scss';
import { LucideIcon } from 'lucide-react';

type IconButtonProps = PropsWithChildren<
  {
    variant?: 'primary' | 'secondary' | 'outlined';
    icon: LucideIcon;
    size?: 'sm' | 'md' | 'lg';
  } & ButtonHTMLAttributes<HTMLButtonElement>
>;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, variant = 'primary', icon, size = 'md', ...rest }, ref) => {
    return (
      <button ref={ref} {...rest} className={[`icon-btn`, `icon-btn--${variant}`].join(' ')}>
        {icon &&
          createElement(icon as React.ElementType, {
            size: size === 'sm' ? 16 : size === 'lg' ? 24 : 20,
            color: '#a5a5a5ff',
          })}
        {children}
      </button>
    );
  }
);
