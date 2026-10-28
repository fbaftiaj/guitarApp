import type { MouseEvent } from 'react';
import { Outlet, ScrollRestoration, useMatches } from 'react-router';
import { cx } from '@/ui/cx';
import { MainNav } from './MainNav';
import { NavigationProgress } from './NavigationProgress';
import { NoticeArea } from './NoticeArea';
import { useFocusOnNavigate } from './useFocusOnNavigate';
import { useThemeSync } from './useThemeSync';

const MAIN_ID = 'main';

function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
  // Focus directly instead of following the hash, which would add a history
  // entry the router treats as a navigation.
  event.preventDefault();
  document.getElementById(MAIN_ID)?.focus();
}

/** A route's `handle` can ask for the screen without the main navigation (e.g. setup). */
export interface RouteHandle {
  hideNavigation?: boolean;
}

function hidesNavigation(handle: unknown): boolean {
  return typeof handle === 'object' && handle !== null && 'hideNavigation' in handle
    ? handle.hideNavigation === true
    : false;
}

export function AppShell() {
  useThemeSync();
  useFocusOnNavigate();
  const navigation = !useMatches().some((match) => hidesNavigation(match.handle));

  return (
    <div
      className={cx(
        'min-h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]',
        navigation && 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]',
      )}
    >
      <a
        href={`#${MAIN_ID}`}
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold"
      >
        Skip to content
      </a>
      {navigation && <MainNav />}
      <main
        id={MAIN_ID}
        tabIndex={-1}
        className={cx(
          'min-w-0 outline-none',
          navigation
            ? 'pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] lg:pb-0'
            : 'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        <Outlet />
      </main>
      <NoticeArea />
      <NavigationProgress />
      <ScrollRestoration />
    </div>
  );
}
