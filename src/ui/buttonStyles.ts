import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export interface ButtonStyleOptions {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  fullWidth?: boolean | undefined;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-strong',
  secondary: 'border border-border bg-surface-raised text-fg hover:border-border-strong',
  ghost: 'text-fg-muted hover:bg-surface-raised hover:text-fg',
};

// Both sizes keep the 44 × 44 px minimum touch target.
const sizes: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-14 px-6 text-base',
};

/** Shared by <Button> and <ButtonLink> so links and buttons look identical. */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: ButtonStyleOptions = {}): string {
  return cx(
    'inline-flex select-none items-center justify-center gap-2 rounded-control font-semibold',
    'transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    fullWidth && 'w-full',
  );
}

export const iconButtonClasses = cx(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-fg-muted',
  'transition-colors hover:bg-surface-raised hover:text-fg',
);
