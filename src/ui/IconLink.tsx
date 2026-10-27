import type { LucideIcon } from 'lucide-react';
import { Link, type LinkProps } from 'react-router';
import { iconButtonClasses } from './buttonStyles';
import { cx } from './cx';

interface IconLinkProps extends Omit<LinkProps, 'children' | 'aria-label'> {
  icon: LucideIcon;
  /** Accessible name; also shown as a tooltip. */
  label: string;
}

/** An icon-only router link, e.g. a header "back" or "settings" action. */
export function IconLink({ icon: Icon, label, className, ...rest }: IconLinkProps) {
  return (
    <Link aria-label={label} title={label} className={cx(iconButtonClasses, className)} {...rest}>
      <Icon aria-hidden className="size-6" />
    </Link>
  );
}
