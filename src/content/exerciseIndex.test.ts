// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { COURSE } from './course';
import { ALL_EXERCISES } from './exerciseIndex';
import { EXERCISES } from './exercises';
import { SONGS } from './songs';

describe('ALL_EXERCISES', () => {
  it('holds every exercise once, under a unique id', () => {
    const parts = COURSE.stages.reduce((sum, stage) => sum + (stage.test?.parts.length ?? 0), 0);
    expect(ALL_EXERCISES.size).toBe(
      EXERCISES.length + SONGS.length + COURSE.lessons.length + parts,
    );
    expect(ALL_EXERCISES.get('parts-of-the-guitar')?.tempo).toBe(60);
    expect(ALL_EXERCISES.get('first-steps-test-1')?.title).toBe('Open strings');
  });
});
