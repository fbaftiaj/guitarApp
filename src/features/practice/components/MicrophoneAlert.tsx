import type { ReactNode } from 'react';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { LISTENING_ERRORS, type ListeningError } from '../listening/microphoneErrors';

interface MicrophoneAlertProps {
  error: ListeningError;
  onRetry: () => void;
  /** Extra actions next to Try again. */
  children?: ReactNode;
  className?: string;
}

/** Why listening could not start, and what to do about it. */
export function MicrophoneAlert({ error, onRetry, children, className }: MicrophoneAlertProps) {
  const copy = LISTENING_ERRORS[error];
  return (
    <div
      role="alert"
      className={cx('rounded-control border border-danger/50 bg-danger/10 p-3', className)}
    >
      <p className="text-sm font-semibold">{copy.title}</p>
      <p className="mt-1 text-sm text-fg-muted">{copy.description}</p>
      {(copy.retry || children) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {copy.retry && <Button onClick={onRetry}>Try again</Button>}
          {children}
        </div>
      )}
    </div>
  );
}
