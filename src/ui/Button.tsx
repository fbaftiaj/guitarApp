import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { buttonClasses, type ButtonStyleOptions } from './buttonStyles';
import { cx } from './cx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  icon?: LucideIcon | undefined;
}

export function Button({
  variant,
  size,
  fullWidth,
  icon: Icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClasses({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {Icon && <Icon aria-hidden className="size-5 shrink-0" />}
      {children}
    </button>
  );
}
