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
  ({ children, variant = 'primary', icon, size = 'md', className, ...rest }, ref) => {
    const getIconStyle = () => {
      switch (size) {
        case 'sm':
          return { size: 16, padding: '6px' };
        case 'md':
          return { size: 24, padding: '8px' };
        case 'lg':
          return { size: 32, padding: '4px' };
      }
    };

    return (
      <button
        style={getIconStyle()}
        ref={ref}
        {...rest}
        className={[`icon-btn`, `icon-btn--${variant}`, className].filter(Boolean).join(' ')}
      >
        {icon &&
          createElement(icon as React.ElementType, {
            color: '#a5a5a5ff',
            size: getIconStyle().size,
          })}
        {children}
      </button>
    );
  }
);
