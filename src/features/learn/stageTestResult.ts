import { starsFor } from '../practice/scoring/stars';
import type { SessionSummary } from '../practice/scoring/summary';
import type { StarCount } from '@/storage/types';

export interface StageTestResult {
  /** Over every part, weighted by how many strums or notes each had. */
  accuracy: number;
  stars: StarCount;
  passed: boolean;
}

/** The combined result of a stage test's parts. */
export function stageTestResult(parts: readonly SessionSummary[]): StageTestResult {
  const total = parts.reduce((sum, part) => sum + part.total, 0);
  const accuracy =
    total > 0 ? parts.reduce((sum, part) => sum + part.accuracy * part.total, 0) / total : 0;
  const stars = starsFor(accuracy);
  return { accuracy, stars, passed: stars > 0 };
}
