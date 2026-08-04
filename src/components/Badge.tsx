import type { ReactNode } from 'react';
import './Badge.css';

type BadgeProps = {
  children: ReactNode;
  tone: 'success' | 'warn' | 'error';
};

export function Badge({ children, tone }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
