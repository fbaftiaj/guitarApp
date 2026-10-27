import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-accent/15 text-accent-text">
        <Icon aria-hidden className="size-8" />
      </div>
      <h2 className="text-lg font-semibold text-balance">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-pretty text-fg-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
