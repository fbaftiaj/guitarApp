import { RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface ErrorStateProps {
  title: string;
  description: ReactNode;
  onRetry?: (() => void) | undefined;
  retryLabel?: string;
  /** Extra action shown next to the retry button, e.g. a link home. */
  secondaryAction?: ReactNode;
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  secondaryAction,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-danger/15 text-danger">
        <TriangleAlert aria-hidden className="size-8" />
      </div>
      <h2 className="text-lg font-semibold text-balance">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-pretty text-fg-muted">{description}</p>
      {(onRetry ?? secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <Button icon={RefreshCw} onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
