import { useId } from 'react';
import { cx } from './cx';

interface SwitchProps {
  label: string;
  /** Extra explanation shown under the label and read after it. */
  description?: string | undefined;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

/** An on/off setting: a button with the switch role, labelled by its visible text. */
export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: SwitchProps) {
  const descriptionId = useId();
  return (
    <div className={className}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-control text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text disabled:opacity-50"
      >
        {label}
        <span
          aria-hidden
          className={cx(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
            checked ? 'border-accent bg-accent' : 'border-border-strong bg-track',
          )}
        >
          <span
            className={cx(
              'size-5 rounded-full shadow-sm transition-transform duration-150',
              checked ? 'translate-x-6 bg-accent-fg' : 'translate-x-1 bg-fg-muted',
            )}
          />
        </span>
      </button>
      {description && (
        <p id={descriptionId} className="-mt-1 pb-1 text-xs text-fg-muted">
          {description}
        </p>
      )}
    </div>
  );
}
