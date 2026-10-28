import type { StarCount } from '@/storage/types';

/** Accuracy needed for one, two and three stars. */
export const STAR_THRESHOLDS = [0.7, 0.85, 0.95] as const;

export function starsFor(accuracy: number): StarCount {
  if (accuracy >= STAR_THRESHOLDS[2]) return 3;
  if (accuracy >= STAR_THRESHOLDS[1]) return 2;
  if (accuracy >= STAR_THRESHOLDS[0]) return 1;
  return 0;
}
