import type { ReactNode } from 'react';
import './Button.css';

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

export function Button({
  children,
  variant = 'primary',
  disabled = false,
}: ButtonProps) {
  return (
    <button type="button" className={`button button--${variant}`} disabled={disabled}>
      {children}
    </button>
  );
}
