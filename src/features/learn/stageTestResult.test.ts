// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionSummary } from '../practice/scoring/summary';
import { stageTestResult } from './stageTestResult';

const part = (accuracy: number, total: number) => ({ accuracy, total }) as SessionSummary;

describe('stageTestResult', () => {
  it('weights each part by its number of targets', () => {
    // (1 × 12 + 0.5 × 4) / 16 = 0.875
    expect(stageTestResult([part(1, 12), part(0.5, 4)])).toEqual({
      accuracy: 0.875,
      stars: 2,
      passed: true,
    });
  });

  it('fails below 70 %', () => {
    expect(stageTestResult([part(0.9, 10), part(0.4, 10)])).toMatchObject({
      stars: 0,
      passed: false,
    });
  });

  it('scores no parts as zero', () => {
    expect(stageTestResult([])).toEqual({ accuracy: 0, stars: 0, passed: false });
  });
});
