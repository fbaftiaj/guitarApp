import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { iconButtonClasses } from './buttonStyles';
import { cx } from './cx';

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  icon: LucideIcon;
  /** Accessible name; also shown as a tooltip. */
  label: string;
}

export function IconButton({
  icon: Icon,
  label,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(iconButtonClasses, className)}
      {...rest}
    >
      <Icon aria-hidden className="size-6" />
    </button>
  );
}
