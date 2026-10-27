import { LoadingState } from '@/ui/LoadingState';

/** Shown while the first screen's code loads. */
export function AppLoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LoadingState label="Loading FretPath…" />
    </div>
  );
}
