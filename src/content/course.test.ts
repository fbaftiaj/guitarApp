// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CHORDS } from './chords';
import {
  COURSE,
  LESSONS_PER_UNIT,
  UNITS_PER_STAGE,
  findLesson,
  findStage,
  findStageTest,
  parseCourse,
} from './course';
import { EXERCISES } from './exercises';
import { SONGS } from './songs';

const stages = [
  { id: 'one', number: 1, title: 'One', summary: 'Stage one.', skills: ['chords'] },
  { id: 'two', number: 2, title: 'Two', summary: 'Stage two.', skills: ['chords'] },
];

const music = {
  kind: 'chords',
  timeSignature: { beats: 4, unit: 4 },
  tempo: 70,
  strum: 'quarters',
  repeat: 2,
  bars: [{ chords: ['Em'] }, { chords: ['Am'] }],
};

function lesson(id: string, overrides: object = {}) {
  return {
    id,
    title: `Lesson ${id}`,
    summary: 'A lesson.',
    skills: ['chords'],
    learn: {
      what: 'What and why.',
      steps: ['Do this.'],
      mistakes: [{ mistake: 'A mistake.', fix: 'A fix.' }],
    },
    exercise: music,
    ...overrides,
  };
}

function unit(id: string, count = 4, last: object = { exercise: undefined, song: 'oh-susanna' }) {
  return {
    id,
    title: `Unit ${id}`,
    summary: 'A unit.',
    lessons: Array.from({ length: count }, (_, i) =>
      lesson(`${id}-${i + 1}`, i === count - 1 ? last : {}),
    ),
  };
}

function stageTest(id: string, overrides: object = {}) {
  return {
    id,
    title: 'Stage test',
    summary: 'A test.',
    parts: [
      { title: 'Part one', skills: ['chords'], exercise: music },
      { title: 'Part two', skills: ['rhythm'], exercise: music },
    ],
    ...overrides,
  };
}

function stageContent(stage: string, prefix = stage, test: object = stageTest(`${prefix}-test`)) {
  return {
    stage,
    test,
    units: [unit(`${prefix}-a`, 4, {}), unit(`${prefix}-b`, 4, {}), unit(`${prefix}-c`)],
  };
}

function parse(content: readonly unknown[], taken: readonly string[] = []) {
  return parseCourse({ stages, content }, SONGS, new Set(taken));
}

describe('course content', () => {
  it('has eight stages, the first three with full lessons', () => {
    expect(COURSE.stages.map((stage) => stage.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const full = COURSE.stages.filter((stage) => stage.units.length > 0);
    expect(full.map((stage) => stage.number)).toEqual([1, 2, 3]);
    for (const stage of full) {
      expect(stage.units.length).toBeGreaterThanOrEqual(UNITS_PER_STAGE.min);
      expect(stage.units.length).toBeLessThanOrEqual(UNITS_PER_STAGE.max);
      for (const { lessons } of stage.units) {
        expect(lessons.length).toBeGreaterThanOrEqual(LESSONS_PER_UNIT.min);
        expect(lessons.length).toBeLessThanOrEqual(LESSONS_PER_UNIT.max);
      }
    }
    expect(COURSE.lessons).toHaveLength(45);
  });

  it('only references chords in the chord library', () => {
    for (const lesson of COURSE.lessons) {
      const { exercise } = lesson;
      const ids =
        exercise.kind === 'chords'
          ? exercise.bars.flatMap((bar) => bar.chords)
          : exercise.bars.flatMap((bar) => (bar.chord ? [bar.chord] : []));
      for (const id of ids) expect(CHORDS.has(id), `${lesson.id}: ${id}`).toBe(true);
    }
  });

  it('gives every lesson unique ids, Learn content and an exercise named after it', () => {
    const taken = new Set([...EXERCISES.map((e) => e.id), ...SONGS.map((s) => s.id)]);
    const ids = COURSE.lessons.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const lesson of COURSE.lessons) {
      expect(taken.has(lesson.id), lesson.id).toBe(false);
      expect(lesson.exercise.id).toBe(lesson.id);
      expect(lesson.learn.steps.length).toBeGreaterThan(0);
      expect(lesson.learn.mistakes.length).toBeGreaterThan(0);
      expect(lesson.phraseBars).toBeGreaterThan(0);
      expect(lesson.phraseBars).toBeLessThanOrEqual(lesson.exercise.bars.length);
    }
  });

  it('ends every full stage with a stage song', () => {
    for (const stage of COURSE.stages.filter((s) => s.lessons.length > 0)) {
      expect(stage.lessons.at(-1)?.songId, stage.id).not.toBeNull();
    }
    expect(findStage('first-steps')?.lessons.at(-1)?.songId).toBe('ode-to-joy');
  });

  it('outlines every preview stage, for at least 120 lessons in all', () => {
    const previews = COURSE.stages.filter((stage) => stage.lessons.length === 0);
    expect(previews.map((stage) => stage.number)).toEqual([4, 5, 6, 7, 8]);
    for (const stage of previews) {
      expect(stage.outline.length, stage.id).toBeGreaterThanOrEqual(UNITS_PER_STAGE.min);
      expect(stage.outline.length, stage.id).toBeLessThanOrEqual(UNITS_PER_STAGE.max);
      for (const unit of stage.outline) {
        expect(unit.lessons.length, unit.id).toBeGreaterThanOrEqual(LESSONS_PER_UNIT.min);
        expect(unit.lessons.length, unit.id).toBeLessThanOrEqual(LESSONS_PER_UNIT.max);
      }
    }
    const planned = previews.flatMap((stage) => stage.outline.flatMap((unit) => unit.lessons));
    const ids = [
      ...COURSE.lessons.map((lesson) => lesson.id),
      ...planned.map((lesson) => lesson.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(120);
    expect(
      COURSE.stages
        .filter((stage) => stage.lessons.length > 0)
        .every((s) => s.outline.length === 0),
    ).toBe(true);
  });

  it('ends every full stage with a test of mixed parts', () => {
    for (const stage of COURSE.stages) {
      if (stage.lessons.length === 0) {
        expect(stage.test, stage.id).toBeNull();
        continue;
      }
      expect(stage.test?.stageId).toBe(stage.id);
      expect(stage.test?.parts.length).toBeGreaterThanOrEqual(2);
      const ids = stage.test?.parts.map((part) => part.exercise.id);
      expect(ids).toEqual(ids?.map((_, i) => `${stage.test?.id ?? ''}-${i + 1}`));
    }
    expect(findStageTest('first-steps')?.parts.map((part) => part.title)).toEqual([
      'Open strings',
      'Fretted notes',
      'A short melody',
    ]);
    expect(findStageTest('open-chords-2')).toBeUndefined();
  });

  it('builds song lessons from the song, demoing its first section', () => {
    const lesson = findLesson('stage-2-song');
    const song = SONGS.find((candidate) => candidate.id === 'oh-susanna');
    expect(lesson?.exercise.bars).toEqual(song?.exercise.bars);
    expect(lesson?.phraseBars).toBe(8);
  });

  it('keeps an exercise’s bars before repeats for the demo', () => {
    const [stage] = parse([stageContent('one')]).stages;
    const first = stage?.lessons[0];
    expect(first?.exercise.bars).toHaveLength(4);
    expect(first?.phraseBars).toBe(2);
    expect(first?.stageId).toBe('one');
    expect(first?.unitId).toBe('one-a');
  });
});

describe('course validation', () => {
  it('parses a valid course, with a later stage as a preview', () => {
    const course = parse([stageContent('one')]);
    expect(course.stages[1]?.units).toEqual([]);
    expect(course.lessons).toHaveLength(12);
  });

  it.each([
    [
      'an unknown chord',
      [
        {
          ...stageContent('one'),
          units: [
            unit('x', 4, { exercise: { ...music, bars: [{ chords: ['Hm'] }] } }),
            ...stageContent('one').units.slice(1),
          ],
        },
      ],
      'lesson "x-4", bar 1: unknown chord "Hm"',
    ],
    [
      'an unknown song',
      [
        {
          ...stageContent('one'),
          units: [unit('a'), unit('b'), unit('c', 4, { exercise: undefined, song: 'nope' })],
        },
      ],
      'lesson "c-4": unknown song "nope"',
    ],
    [
      'a lesson with both an exercise and a song',
      [
        {
          ...stageContent('one'),
          units: [unit('a'), unit('b'), unit('c', 4, { song: 'oh-susanna' })],
        },
      ],
      'lesson "c-4": give either an exercise or a song',
    ],
    [
      'a stage that does not end with a song',
      [{ ...stageContent('one'), units: [unit('a'), unit('b'), unit('c', 4, {})] }],
      'stage "one" should end with a stage song',
    ],
    [
      'lessons for a stage after a preview',
      [stageContent('two')],
      'stage "two" has lessons but stage "one" does not',
    ],
    [
      'duplicate lesson ids',
      [stageContent('one'), stageContent('two', 'one')],
      'duplicate lesson id "one-a-1"',
    ],
    ['lessons for an unknown stage', [stageContent('three')], 'unknown stage "three"'],
    [
      'too few lessons in a unit',
      [{ ...stageContent('one'), units: [unit('a', 3), unit('b'), unit('c')] }],
      'units',
    ],
    [
      'too few units in a stage',
      [{ ...stageContent('one'), units: [unit('a'), unit('c')] }],
      'units',
    ],
  ])('rejects %s', (_, content, message) => {
    expect(() => parse(content)).toThrow(message);
  });

  it.each([
    [
      'a test part that does not fit the bar',
      stageTest('one-test', {
        parts: [
          { title: 'A', skills: ['chords'], exercise: music },
          { title: 'B', skills: ['chords'], exercise: { ...music, strum: 'waltz' } },
        ],
      }),
      'stage test "one-test", part 2, bar 1: strum "waltz" has 6 slots, needs 8',
    ],
    ['a test reusing a lesson id', stageTest('one-a-1'), 'the id "one-a-1" is already taken'],
    ['a test with one part', stageTest('one-test', { parts: [] }), 'parts'],
  ])('rejects %s', (_, test, message) => {
    expect(() => parse([stageContent('one', 'one', test)])).toThrow(message);
  });

  const outline = (stage: string, prefix: string, lessons = 4) => ({
    stage,
    outline: ['a', 'b', 'c'].map((unit) => ({
      id: `${prefix}-${unit}`,
      title: 'Unit',
      summary: 'A unit.',
      lessons: Array.from({ length: lessons }, (_, i) => ({
        id: `${prefix}-${unit}-${i + 1}`,
        title: 'Lesson',
        summary: 'An objective.',
      })),
    })),
  });

  it('builds a preview stage from its outline', () => {
    const course = parseCourse(
      { stages, content: [stageContent('one')], outlines: [outline('two', 'two')] },
      SONGS,
      new Set(),
    );
    expect(course.stages[1]?.outline.map((unit) => unit.lessons.length)).toEqual([4, 4, 4]);
    expect(course.stages[1]?.lessons).toEqual([]);
  });

  it.each([
    [
      'an outline for a stage with lessons',
      [outline('one', 'x')],
      'stage "one" has both lessons and an outline',
    ],
    [
      'an outline for an unknown stage',
      [outline('three', 'x')],
      'outline for unknown stage "three"',
    ],
    ['an outline reusing a lesson id', [outline('two', 'one')], 'duplicate unit id "one-a"'],
    ['an outlined unit with three lessons', [outline('two', 'x', 3)], 'lessons'],
  ])('rejects %s', (_, outlines, message) => {
    expect(() =>
      parseCourse({ stages, content: [stageContent('one')], outlines }, SONGS, new Set()),
    ).toThrow(message);
  });

  it('rejects a lesson id taken by an exercise or song', () => {
    expect(() => parse([stageContent('one')], ['one-a-1'])).toThrow(
      'lesson "one-a-1": the id is taken by an exercise or song',
    );
  });

  it('rejects stages out of order', () => {
    expect(() =>
      parseCourse({ stages: [...stages].reverse(), content: [] }, SONGS, new Set()),
    ).toThrow('stage "two" should be number 1');
  });
});
