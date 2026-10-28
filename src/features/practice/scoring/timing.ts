/**
 * Timing windows and credit. A hit is judged on the onset minus the target
 * time, after removing the measured input/output latency.
 */

export type Timing = 'perfect' | 'good' | 'early' | 'late' | 'miss';

export const TIMING_WINDOWS = {
  /** Within ±40 ms. */
  perfect: 0.04,
  /** Within ±90 ms. */
  good: 0.09,
  /** Beyond ±200 ms an onset belongs to no target. */
  hit: 0.2,
} as const;

/** Share of a target's score each timing earns (with the right chord or note). */
export const TIMING_CREDIT: Record<Timing, number> = {
  perfect: 1,
  good: 0.85,
  early: 0.5,
  late: 0.5,
  miss: 0,
};

/** Timing of an onset `deviation` seconds after its target (negative = before), or null if too far. */
export function classifyTiming(deviation: number): Exclude<Timing, 'miss'> | null {
  const distance = Math.abs(deviation);
  if (distance <= TIMING_WINDOWS.perfect) return 'perfect';
  if (distance <= TIMING_WINDOWS.good) return 'good';
  if (distance <= TIMING_WINDOWS.hit) return deviation < 0 ? 'early' : 'late';
  return null;
}
