import type { MouseEvent } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
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

export function AppShell() {
  useThemeSync();
  useFocusOnNavigate();

  return (
    <div className="min-h-dvh pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href={`#${MAIN_ID}`}
        onClick={skipToMain}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold"
      >
        Skip to content
      </a>
      <MainNav />
      <main
        id={MAIN_ID}
        tabIndex={-1}
        className="min-w-0 pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] outline-none lg:pb-0"
      >
        <Outlet />
      </main>
      <NoticeArea />
      <NavigationProgress />
      <ScrollRestoration />
    </div>
  );
}
