// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COURSE } from '@/content/course';
import type { LessonProgress, StarCount } from '@/storage/types';
import { learnedChords } from './learnedChords';

const done = (...ids: string[]) => progress(1, ids);

function progress(stars: StarCount, ids: readonly string[]): Record<string, LessonProgress> {
  return Object.fromEntries(
    ids.map((lessonId): [string, LessonProgress] => [
      lessonId,
      { lessonId, stars, bestAccuracy: 0.8, attempts: 1, completedAt: 1, updatedAt: 1 },
    ]),
  );
}

describe('learnedChords', () => {
  it('starts empty', () => {
    expect(learnedChords(COURSE, {})).toEqual([]);
  });

  it('collects the chords of completed lessons, once each, in course order', () => {
    expect(
      learnedChords(COURSE, done('changing-em-am', 'reading-chord-diagrams', 'e-major-chord')),
    ).toEqual(['Em', 'E', 'Am']);
  });

  it('ignores failed checks', () => {
    const failed = { ...done('e-minor-chord'), ...progress(0, ['a-minor-chord']) };
    expect(learnedChords(COURSE, failed)).toEqual(['Em']);
  });
});
