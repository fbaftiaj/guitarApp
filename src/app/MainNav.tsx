import { NavLink } from 'react-router';
import { cx } from '@/ui/cx';
import { APP_NAME } from './brand';
import { TABS } from './navigation';

/**
 * Primary navigation: a bottom tab bar on phones (thumb reach) and a side
 * rail on large screens. One element serves both layouts so assistive tech
 * sees a single "Main" navigation landmark.
 */
export function MainNav() {
  return (
    <nav
      aria-label="Main"
      className={cx(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md',
        'lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-t-0 lg:border-r lg:bg-surface lg:pb-0 lg:backdrop-blur-none',
      )}
    >
      <div className="hidden items-center gap-3 px-6 pt-[max(env(safe-area-inset-top),1.75rem)] pb-8 lg:flex">
        <img src="/favicon.svg" alt="" width={36} height={36} className="size-9" />
        <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
      </div>
      <ul className="mx-auto flex h-tabbar max-w-xl lg:mx-0 lg:h-auto lg:max-w-none lg:flex-col lg:gap-1 lg:px-3">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1 lg:flex-none">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cx(
                  'flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                  'lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-control lg:px-3 lg:text-sm',
                  isActive
                    ? 'text-accent-text lg:bg-surface-raised'
                    : 'text-fg-muted hover:text-fg lg:hover:bg-surface-raised/60',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      'flex h-7 w-14 items-center justify-center rounded-full transition-colors lg:h-auto lg:w-auto',
                      isActive && 'bg-accent/15 lg:bg-transparent',
                    )}
                  >
                    <Icon aria-hidden className="size-5" strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  <span className={cx(isActive && 'font-semibold')}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
