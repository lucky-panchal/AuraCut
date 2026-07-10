import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export default function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button className={`btn btn--${variant} ${className}`.trim()} {...props} />
  );
}
