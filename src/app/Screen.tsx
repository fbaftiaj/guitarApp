import { ChevronLeft } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { IconLink } from '@/ui/IconLink';
import { APP_NAME } from './brand';

interface ScreenProps {
  title: string;
  /** Renders a back link in the header, for screens below a tab. */
  backTo?: string;
  backLabel?: string;
  /** Trailing header actions, e.g. an icon link to settings. */
  actions?: ReactNode;
  children: ReactNode;
}

/** Standard screen layout: sticky header with the page <h1>, then content. */
export function Screen({ title, backTo, backLabel = 'Back', actions, children }: ScreenProps) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center gap-1 px-4 lg:min-h-16 lg:px-8">
          {backTo && (
            <IconLink to={backTo} icon={ChevronLeft} label={backLabel} className="-ml-3" />
          )}
          {/* Focused programmatically on navigation so screen readers announce the new screen. */}
          <h1
            tabIndex={-1}
            className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight outline-none"
          >
            {title}
          </h1>
          {actions}
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
    </>
  );
}
