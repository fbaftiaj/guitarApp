import { z } from 'zod/mini';
import { skillIdSchema, type SkillId } from '@/storage/types';
import stage1Json from './course/stage-1.json';
import stage2Json from './course/stage-2.json';
import stage3Json from './course/stage-3.json';
import stage4Json from './course/stage-4.json';
import stage5Json from './course/stage-5.json';
import stage6Json from './course/stage-6.json';
import stage7Json from './course/stage-7.json';
import stage8Json from './course/stage-8.json';
import stagesJson from './course/stages.json';
import { EXERCISES, buildExercise, checkMusic, musicSchema, type Exercise } from './exercises';
import { parseOrThrow, report, slug, text } from './schemaParts';
import { SONGS, type Song } from './songs';

/**
 * The course: Course → Stage → Unit → Lesson, validated when the module
 * loads. stages.json lists every stage; a stage's lessons live in its own
 * file. A stage that only has an outline (units and lessons with their
 * titles and objectives) is a preview, shown but not yet playable.
 *
 * Each lesson runs Learn → Listen → Practice → Check on one exercise: its own
 * music, or a song from the library. Each playable stage ends with a stage
 * test: a few short mixed parts, scored together. Everything a lesson shows on the Learn
 * step beyond its text (chord diagrams, tab, the fretboard demo) is derived
 * from that exercise.
 */

export type LessonFigure = 'guitar-parts' | 'finger-numbers';

export interface LessonLearn {
  /** What the lesson teaches and why it matters. */
  what: string;
  /** How to do it, step by step. */
  steps: readonly string[];
  mistakes: readonly { mistake: string; fix: string }[];
  tip: string | null;
  /** An illustration shown with the text. */
  figure: LessonFigure | null;
  /** A tool the lesson sends the player to, e.g. the tuner. */
  tool: 'tuner' | null;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  skills: readonly SkillId[];
  learn: LessonLearn;
  /** Played on the Listen, Practice and Check steps; its id is the lesson id. */
  exercise: Exercise;
  songId: string | null;
  /** Bars of the exercise before repeats, for the short Learn-step demo. */
  phraseBars: number;
  stageId: string;
  unitId: string;
}

export interface Unit {
  id: string;
  title: string;
  summary: string;
  lessons: readonly Lesson[];
}

export interface StageTestPart {
  title: string;
  /** Its id is the test id plus the part number, e.g. "first-steps-test-1". */
  exercise: Exercise;
}

/** The mixed test at the end of a stage: passing it opens the next stage. */
export interface StageTest {
  id: string;
  title: string;
  summary: string;
  stageId: string;
  parts: readonly StageTestPart[];
}

/** A lesson of a preview stage: what it will teach, not yet playable. */
export interface PlannedLesson {
  id: string;
  title: string;
  summary: string;
}

export interface PlannedUnit {
  id: string;
  title: string;
  summary: string;
  lessons: readonly PlannedLesson[];
}

export interface Stage {
  id: string;
  number: number;
  title: string;
  summary: string;
  skills: readonly SkillId[];
  /** Empty for a preview stage. */
  units: readonly Unit[];
  /** Every lesson of the stage, in order. */
  lessons: readonly Lesson[];
  /** Null for a preview stage. */
  test: StageTest | null;
  /** A preview stage's planned units; empty for a playable stage. */
  outline: readonly PlannedUnit[];
}

export interface Course {
  stages: readonly Stage[];
  /** Every playable lesson, in course order. */
  lessons: readonly Lesson[];
}

/** A full stage has this many units, of this many lessons each. */
export const UNITS_PER_STAGE = { min: 3, max: 5 } as const;
export const LESSONS_PER_UNIT = { min: 4, max: 8 } as const;
export const PARTS_PER_TEST = { min: 2, max: 4 } as const;

const stageSchema = z.object({
  id: slug,
  number: z.int().check(z.gte(1)),
  title: text,
  summary: text,
  skills: z.array(skillIdSchema).check(z.minLength(1)),
});

const lessonSchema = z.object({
  id: slug,
  title: text,
  summary: text,
  skills: z.array(skillIdSchema).check(z.minLength(1)),
  learn: z.object({
    what: text,
    steps: z.array(text).check(z.minLength(1), z.maxLength(6)),
    mistakes: z.array(z.object({ mistake: text, fix: text })).check(z.minLength(1), z.maxLength(4)),
    tip: z.optional(text),
    figure: z.optional(z.enum(['guitar-parts', 'finger-numbers'])),
    tool: z.optional(z.enum(['tuner'])),
  }),
  /** The lesson's own music… */
  exercise: z.optional(musicSchema),
  /** …or a song from the library, by id. */
  song: z.optional(slug),
});
type LessonData = z.infer<typeof lessonSchema>;

const unitSchema = z.object({
  id: slug,
  title: text,
  summary: text,
  lessons: z
    .array(lessonSchema)
    .check(z.minLength(LESSONS_PER_UNIT.min), z.maxLength(LESSONS_PER_UNIT.max)),
});

const stageTestSchema = z.object({
  id: slug,
  title: text,
  summary: text,
  parts: z
    .array(
      z.object({
        title: text,
        skills: z.array(skillIdSchema).check(z.minLength(1)),
        exercise: musicSchema,
      }),
    )
    .check(z.minLength(PARTS_PER_TEST.min), z.maxLength(PARTS_PER_TEST.max)),
});
type StageTestData = z.infer<typeof stageTestSchema>;

const testPartId = (testId: string, index: number) => `${testId}-${index + 1}`;

const stageContentSchema = z.object({
  stage: slug,
  test: stageTestSchema,
  units: z
    .array(unitSchema)
    .check(z.minLength(UNITS_PER_STAGE.min), z.maxLength(UNITS_PER_STAGE.max)),
});

const plannedLessonSchema = z.object({ id: slug, title: text, summary: text });

const stageOutlineSchema = z.object({
  stage: slug,
  outline: z
    .array(
      z.object({
        id: slug,
        title: text,
        summary: text,
        lessons: z
          .array(plannedLessonSchema)
          .check(z.minLength(LESSONS_PER_UNIT.min), z.maxLength(LESSONS_PER_UNIT.max)),
      }),
    )
    .check(z.minLength(UNITS_PER_STAGE.min), z.maxLength(UNITS_PER_STAGE.max)),
});

interface CourseData {
  stages: readonly z.infer<typeof stageSchema>[];
  content: readonly z.infer<typeof stageContentSchema>[];
  outlines: readonly z.infer<typeof stageOutlineSchema>[];
}

function checkLesson(lesson: LessonData, songs: ReadonlyMap<string, Song>, issues: string[]): void {
  const where = `lesson "${lesson.id}"`;
  if ((lesson.exercise === undefined) === (lesson.song === undefined)) {
    issues.push(`${where}: give either an exercise or a song`);
  }
  if (lesson.exercise) checkMusic(lesson.exercise, where, issues);
  if (lesson.song !== undefined && !songs.has(lesson.song)) {
    issues.push(`${where}: unknown song "${lesson.song}"`);
  }
}

function checkCourse(
  course: CourseData,
  songs: ReadonlyMap<string, Song>,
  /** Ids already taken by other exercises: a lesson's exercise shares its id. */
  takenIds: ReadonlySet<string>,
  issues: string[],
): void {
  const stageIds = new Set<string>();
  course.stages.forEach((stage, i) => {
    if (stageIds.has(stage.id)) issues.push(`duplicate stage id "${stage.id}"`);
    stageIds.add(stage.id);
    if (stage.number !== i + 1) issues.push(`stage "${stage.id}" should be number ${i + 1}`);
  });

  const contentFor = new Map<string, CourseData['content'][number]>();
  for (const content of course.content) {
    if (!stageIds.has(content.stage)) issues.push(`lessons for unknown stage "${content.stage}"`);
    if (contentFor.has(content.stage)) issues.push(`stage "${content.stage}" has lessons twice`);
    contentFor.set(content.stage, content);
  }
  // Each stage unlocks once the one before it is passed, so a playable stage
  // after a preview could never be reached.
  course.stages.forEach((stage, i) => {
    const previous = course.stages[i - 1];
    if (previous && contentFor.has(stage.id) && !contentFor.has(previous.id)) {
      issues.push(`stage "${stage.id}" has lessons but stage "${previous.id}" does not`);
    }
  });

  const unitIds = new Set<string>();
  const lessonIds = new Set<string>();
  for (const content of course.content) {
    for (const unit of content.units) {
      if (unitIds.has(unit.id)) issues.push(`duplicate unit id "${unit.id}"`);
      unitIds.add(unit.id);
      for (const lesson of unit.lessons) {
        if (lessonIds.has(lesson.id)) issues.push(`duplicate lesson id "${lesson.id}"`);
        if (takenIds.has(lesson.id)) {
          issues.push(`lesson "${lesson.id}": the id is taken by an exercise or song`);
        }
        lessonIds.add(lesson.id);
        checkLesson(lesson, songs, issues);
      }
    }
    const last = content.units.at(-1)?.lessons.at(-1);
    if (last && last.song === undefined) {
      issues.push(`stage "${content.stage}" should end with a stage song`);
    }

    const { test } = content;
    const ids = [test.id, ...test.parts.map((_, i) => testPartId(test.id, i))];
    for (const id of ids) {
      if (lessonIds.has(id) || takenIds.has(id)) {
        issues.push(`stage test "${test.id}": the id "${id}" is already taken`);
      }
      lessonIds.add(id);
    }
    test.parts.forEach((part, i) => {
      checkMusic(part.exercise, `stage test "${test.id}", part ${i + 1}`, issues);
    });
  }

  const outlined = new Set<string>();
  for (const { stage, outline } of course.outlines) {
    if (!stageIds.has(stage)) issues.push(`outline for unknown stage "${stage}"`);
    if (contentFor.has(stage)) issues.push(`stage "${stage}" has both lessons and an outline`);
    if (outlined.has(stage)) issues.push(`stage "${stage}" has two outlines`);
    outlined.add(stage);
    for (const unit of outline) {
      if (unitIds.has(unit.id)) issues.push(`duplicate unit id "${unit.id}"`);
      unitIds.add(unit.id);
      for (const lesson of unit.lessons) {
        if (lessonIds.has(lesson.id)) issues.push(`duplicate lesson id "${lesson.id}"`);
        lessonIds.add(lesson.id);
      }
    }
  }
}

function buildTest(test: StageTestData, stageId: string): StageTest {
  return {
    id: test.id,
    title: test.title,
    summary: test.summary,
    stageId,
    parts: test.parts.map((part, i) => ({
      title: part.title,
      exercise: buildExercise(
        {
          id: testPartId(test.id, i),
          title: part.title,
          description: test.summary,
          skills: part.skills,
        },
        part.exercise,
      ),
    })),
  };
}

function buildLesson(
  lesson: LessonData,
  songs: ReadonlyMap<string, Song>,
  stageId: string,
  unitId: string,
): Lesson {
  const song = lesson.song === undefined ? undefined : songs.get(lesson.song);
  const music = lesson.exercise ?? song?.music;
  // Validation guarantees one of them.
  if (!music) throw new Error(`lesson "${lesson.id}" has no music`);
  const { learn } = lesson;
  return {
    id: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    skills: lesson.skills,
    learn: {
      what: learn.what,
      steps: learn.steps,
      mistakes: learn.mistakes,
      tip: learn.tip ?? null,
      figure: learn.figure ?? null,
      tool: learn.tool ?? null,
    },
    exercise: buildExercise(
      { id: lesson.id, title: lesson.title, description: lesson.summary, skills: lesson.skills },
      music,
    ),
    songId: song?.id ?? null,
    // A song's demo plays its first section.
    phraseBars:
      song?.sections.find((part) => part.id === song.form[0]?.sectionId)?.bars.length ??
      music.bars.length,
    stageId,
    unitId,
  };
}

/**
 * Parses and checks the course. `songs` are the songs lessons may use;
 * `takenIds` are exercise ids a lesson id must not reuse.
 */
export function parseCourse(
  data: { stages: unknown; content: readonly unknown[]; outlines?: readonly unknown[] },
  songs: readonly Song[],
  takenIds: ReadonlySet<string>,
): Course {
  const songsById = new Map(songs.map((song) => [song.id, song]));
  const schema = z
    .object({
      stages: z.array(stageSchema).check(z.minLength(1)),
      content: z.array(stageContentSchema),
      outlines: z.array(stageOutlineSchema),
    })
    .check(
      z.superRefine((course, ctx) => {
        const issues: string[] = [];
        checkCourse(course, songsById, takenIds, issues);
        report(issues, ctx);
      }),
    );
  const course = parseOrThrow(schema, { outlines: [], ...data }, 'course');

  const stages = course.stages.map((stage): Stage => {
    const content = course.content.find((candidate) => candidate.stage === stage.id);
    const units = (content?.units ?? []).map((unit): Unit => ({
      id: unit.id,
      title: unit.title,
      summary: unit.summary,
      lessons: unit.lessons.map((lesson) => buildLesson(lesson, songsById, stage.id, unit.id)),
    }));
    return {
      ...stage,
      units,
      lessons: units.flatMap((unit) => unit.lessons),
      test: content ? buildTest(content.test, stage.id) : null,
      outline: course.outlines.find((candidate) => candidate.stage === stage.id)?.outline ?? [],
    };
  });
  return { stages, lessons: stages.flatMap((stage) => stage.lessons) };
}

export const COURSE = parseCourse(
  {
    stages: stagesJson,
    content: [stage1Json, stage2Json, stage3Json],
    outlines: [stage4Json, stage5Json, stage6Json, stage7Json, stage8Json],
  },
  SONGS,
  new Set([...EXERCISES.map((exercise) => exercise.id), ...SONGS.map((song) => song.id)]),
);

export function findStage(id: string): Stage | undefined {
  return COURSE.stages.find((stage) => stage.id === id);
}

export function findLesson(id: string): Lesson | undefined {
  return COURSE.lessons.find((lesson) => lesson.id === id);
}

/** The test at the end of the stage `stageId`, if it has one. */
export function findStageTest(stageId: string): StageTest | undefined {
  return findStage(stageId)?.test ?? undefined;
}
