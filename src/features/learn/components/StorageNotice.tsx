import { useProgressStore } from '@/stores/progressStore';

/** Shown when progress can't be saved, so the player knows it will be lost. */
export function StorageNotice() {
  const unavailable = useProgressStore((state) => state.status === 'unavailable');
  if (!unavailable) return null;
  return (
    <p
      role="status"
      className="mb-4 rounded-control border border-warning/50 bg-warning/10 p-3 text-sm"
    >
      This browser isn’t letting FretPath save your progress, so it will be lost when you close the
      app. Private browsing often causes this.
    </p>
  );
}
