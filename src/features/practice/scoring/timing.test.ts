// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { starsFor } from './stars';
import { classifyTiming } from './timing';

describe('classifyTiming', () => {
  it.each([
    [0, 'perfect'],
    [0.04, 'perfect'],
    [-0.04, 'perfect'],
    [0.0401, 'good'],
    [-0.09, 'good'],
    [0.0901, 'late'],
    [-0.0901, 'early'],
    [0.2, 'late'],
    [-0.2, 'early'],
    [0.2001, null],
    [-0.5, null],
  ])('%f s off is %s', (deviation, timing) => {
    expect(classifyTiming(deviation)).toBe(timing);
  });
});

describe('starsFor', () => {
  it.each([
    [0, 0],
    [0.699, 0],
    [0.7, 1],
    [0.849, 1],
    [0.85, 2],
    [0.949, 2],
    [0.95, 3],
    [1, 3],
  ])('%f accuracy earns %i stars', (accuracy, stars) => {
    expect(starsFor(accuracy)).toBe(stars);
  });
});
