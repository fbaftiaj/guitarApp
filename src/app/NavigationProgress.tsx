import { useNavigation } from 'react-router';

/**
 * Thin indeterminate bar shown while a lazily loaded screen downloads. It
 * fades in after a short delay, so cached (instant) navigations never flash it.
 */
export function NavigationProgress() {
  const { state } = useNavigation();
  if (state === 'idle') return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading screen"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 animate-delayed-fade-in overflow-hidden opacity-0"
    >
      <div className="h-full w-1/3 bg-accent motion-safe:animate-indeterminate" />
    </div>
  );
}
