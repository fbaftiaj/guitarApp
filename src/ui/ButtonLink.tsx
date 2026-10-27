import type { LucideIcon } from 'lucide-react';
import { Link, type LinkProps } from 'react-router';
import { buttonClasses, type ButtonStyleOptions } from './buttonStyles';
import { cx } from './cx';

interface ButtonLinkProps extends LinkProps, ButtonStyleOptions {
  icon?: LucideIcon | undefined;
}

/** A router link styled as a button, for navigation actions. */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  icon: Icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cx(buttonClasses({ variant, size, fullWidth }), className)} {...rest}>
      {Icon && <Icon aria-hidden className="size-5 shrink-0" />}
      {children}
    </Link>
  );
}
