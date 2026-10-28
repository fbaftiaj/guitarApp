import { MAX_LATENCY_MS } from '@/stores/settingsStore';

/**
 * Latency: what is heard comes out of the speaker after the output latency,
 * and what is played reaches the analysis after the input latency. Scoring
 * subtracts their sum, measured once by playing along with clicks.
 */

/** A rough input latency for when nothing has been measured yet. */
const ASSUMED_INPUT_SECONDS = 0.012;
/** Bluetooth headphones typically add 150–300 ms. */
export const BLUETOOTH_LATENCY_MS = 150;

export interface LatencyClock {
  outputLatency?: number;
  baseLatency?: number;
}

function finite(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

/** Seconds to subtract from onset times: the calibrated value, else an estimate. */
export function scoringLatency(calibratedMs: number | null, context: LatencyClock): number {
  if (calibratedMs !== null) return calibratedMs / 1000;
  return finite(context.outputLatency) + finite(context.baseLatency) + ASSUMED_INPUT_SECONDS;
}

export type CalibrationResult =
  | { ok: true; latencyMs: number; spreadMs: number; matched: number }
  | { ok: false; reason: 'too-few' | 'uneven'; matched: number };

/** Beats needed out of the calibration's eight. */
export const CALIBRATION_MIN_BEATS = 5;
/** Onsets further than this from the typical offset are stray noises. */
const OUTLIER_SECONDS = 0.06;
const MAX_SPREAD_SECONDS = 0.035;
/** An onset can come a little before its click, or long after (Bluetooth). */
const SEARCH = { before: 0.1, after: MAX_LATENCY_MS / 1000 } as const;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Measures latency from calibration clicks (scheduled audio times) and the
 * onsets heard while the player played along: the typical offset between
 * each click and the first onset after it, ignoring strays.
 */
export function analyzeCalibration(
  clickTimes: readonly number[],
  onsetTimes: readonly number[],
): CalibrationResult {
  const sorted = [...onsetTimes].sort((a, b) => a - b);
  const offsets: number[] = [];
  clickTimes.forEach((click, i) => {
    const next = clickTimes[i + 1] ?? Infinity;
    const window = Math.min(SEARCH.after, next - click - SEARCH.before);
    const onset = sorted.find((time) => time >= click - SEARCH.before && time <= click + window);
    if (onset !== undefined) offsets.push(onset - click);
  });
  if (offsets.length < CALIBRATION_MIN_BEATS) {
    return { ok: false, reason: 'too-few', matched: offsets.length };
  }
  const typical = median(offsets);
  const kept = offsets.filter((offset) => Math.abs(offset - typical) <= OUTLIER_SECONDS);
  if (kept.length < CALIBRATION_MIN_BEATS) {
    return { ok: false, reason: 'uneven', matched: kept.length };
  }
  const mean = kept.reduce((sum, offset) => sum + offset, 0) / kept.length;
  const spread = Math.sqrt(
    kept.reduce((sum, offset) => sum + (offset - mean) ** 2, 0) / kept.length,
  );
  if (spread > MAX_SPREAD_SECONDS) return { ok: false, reason: 'uneven', matched: kept.length };
  const latencyMs = Math.round(Math.min(MAX_LATENCY_MS, Math.max(0, mean * 1000)));
  return { ok: true, latencyMs, spreadMs: Math.round(spread * 1000), matched: kept.length };
}
