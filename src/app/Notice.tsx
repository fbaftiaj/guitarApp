import { X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';

interface NoticeProps {
  icon: LucideIcon;
  tone?: 'info' | 'warning';
  /** `alert` interrupts screen readers; use it only for problems. */
  role?: 'status' | 'alert';
  onDismiss: () => void;
  dismissLabel?: string;
  children: ReactNode;
}

/** A dismissible toast-style card, stacked in the <NoticeArea>. */
export function Notice({
  icon: Icon,
  tone = 'info',
  role = 'status',
  onDismiss,
  dismissLabel = 'Dismiss',
  children,
}: NoticeProps) {
  return (
    <div
      role={role}
      className={cx(
        'pointer-events-auto flex items-start gap-3 rounded-card border bg-surface p-4 text-sm shadow-elevated',
        tone === 'warning' ? 'border-warning/50' : 'border-border',
      )}
    >
      <Icon
        aria-hidden
        className={cx(
          'mt-0.5 size-5 shrink-0',
          tone === 'warning' ? 'text-warning' : 'text-accent-text',
        )}
      />
      <div className="min-w-0 flex-1 text-fg">{children}</div>
      <IconButton icon={X} label={dismissLabel} onClick={onDismiss} className="-my-2.5 -mr-2.5" />
    </div>
  );
}
