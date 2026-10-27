import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Moves focus to the new screen's <h1> after client-side navigation, so
 * screen readers announce it and keyboard users start at the top of the page.
 * The initial load is left alone.
 */
export function useFocusOnNavigate(): void {
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
  }, [pathname]);
}
