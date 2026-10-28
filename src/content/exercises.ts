import { z } from 'zod/mini';
import { skillIdSchema, type SkillId } from '@/storage/types';
import { CHORDS } from './chords';
import exercisesJson from './exercises.json';

/**
 * Play-along exercises, validated when the module loads. A strum pattern has
 * one character per slot — an eighth note in x/4 time, a beat in x/8 time:
 * "D" down, "U" up, "." no strum. Patterns may be named in `strumPatterns`.
 */

export interface TimeSignature {
  beats: number;
  unit: 4 | 8;
}

export interface ChordBar {
  /** Chords sharing the bar equally, in order. */
  chords: readonly string[];
  /** Resolved strum pattern for the whole bar. */
  strum: string;
}

export interface NoteItem {
  beats: number;
  /** Guitar string 1 (high e) … 6 (low E); null for a rest. */
  string: number | null;
  fret: number | null;
  /** Fretting finger 1–4, if the exercise suggests one. */
  finger: number | null;
}

export interface NoteBar {
  /** Harmony for the backing track, if any. */
  chord: string | null;
  notes: readonly NoteItem[];
}

interface ExerciseBase {
  id: string;
  title: string;
  description: string;
  skills: readonly SkillId[];
  timeSignature: TimeSignature;
  /** Target tempo in beats per minute (beats of the time signature's unit). */
  tempo: number;
}

export type Exercise =
  | (ExerciseBase & { kind: 'chords'; bars: readonly ChordBar[] })
  | (ExerciseBase & { kind: 'notes'; bars: readonly NoteBar[] });

export const MIN_TEMPO = 30;
export const MAX_TEMPO = 220;

/** Strum slots per beat: eighth notes in x/4 time, one per beat in x/8 time. */
export function slotsPerBeat({ unit }: TimeSignature): number {
  return unit === 4 ? 2 : 1;
}

const slug = z.string().check(z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
const text = z.string().check(z.minLength(1));
const patternText = z.string().check(z.regex(/^[DU.]+$/));

const common = {
  id: slug,
  title: text,
  description: text,
  skills: z.array(skillIdSchema).check(z.minLength(1)),
  timeSignature: z.object({
    beats: z.int().check(z.gte(2), z.lte(12)),
    unit: z.union([z.literal(4), z.literal(8)]),
  }),
  tempo: z.int().check(z.gte(MIN_TEMPO), z.lte(MAX_TEMPO)),
  /** Plays the bars this many times. */
  repeat: z.optional(z.int().check(z.gte(1), z.lte(16))),
};

const chordExerciseSchema = z.object({
  ...common,
  kind: z.literal('chords'),
  strum: z.string(),
  bars: z
    .array(
      z.object({
        chords: z.array(z.string()).check(z.minLength(1), z.maxLength(4)),
        strum: z.optional(z.string()),
      }),
    )
    .check(z.minLength(1)),
});

const noteExerciseSchema = z.object({
  ...common,
  kind: z.literal('notes'),
  bars: z
    .array(
      z.object({
        chord: z.optional(z.string()),
        notes: z
          .array(
            z.object({
              beats: z.number().check(z.positive()),
              string: z.optional(z.int().check(z.gte(1), z.lte(6))),
              fret: z.optional(z.int().check(z.gte(0), z.lte(15))),
              finger: z.optional(z.int().check(z.gte(1), z.lte(4))),
            }),
          )
          .check(z.minLength(1)),
      }),
    )
    .check(z.minLength(1)),
});

const catalogShape = z.object({
  strumPatterns: z.record(slug, patternText),
  exercises: z
    .array(z.discriminatedUnion('kind', [chordExerciseSchema, noteExerciseSchema]))
    .check(z.minLength(1)),
});

type CatalogData = z.infer<typeof catalogShape>;
type ExerciseData = CatalogData['exercises'][number];

function resolvePattern(patterns: Record<string, string>, value: string): string | null {
  const pattern = patterns[value] ?? value;
  return /^[DU.]+$/.test(pattern) ? pattern : null;
}

function checkExercise(
  exercise: ExerciseData,
  patterns: Record<string, string>,
  issues: string[],
): void {
  const where = `exercise "${exercise.id}"`;
  const { beats } = exercise.timeSignature;
  const slots = beats * slotsPerBeat(exercise.timeSignature);
  const checkChord = (id: string, bar: number) => {
    if (!CHORDS.has(id)) issues.push(`${where}, bar ${bar}: unknown chord "${id}"`);
  };

  if (exercise.kind === 'chords') {
    exercise.bars.forEach((bar, i) => {
      bar.chords.forEach((id) => {
        checkChord(id, i + 1);
      });
      if (beats % bar.chords.length !== 0) {
        issues.push(
          `${where}, bar ${i + 1}: ${bar.chords.length} chords do not split ${beats} beats`,
        );
      }
      const strum = bar.strum ?? exercise.strum;
      const pattern = resolvePattern(patterns, strum);
      if (pattern === null) issues.push(`${where}, bar ${i + 1}: unknown strum pattern "${strum}"`);
      else if (pattern.length !== slots) {
        issues.push(
          `${where}, bar ${i + 1}: strum "${strum}" has ${pattern.length} slots, needs ${slots}`,
        );
      }
    });
    return;
  }

  exercise.bars.forEach((bar, i) => {
    if (bar.chord !== undefined) checkChord(bar.chord, i + 1);
    const total = bar.notes.reduce((sum, note) => sum + note.beats, 0);
    if (Math.abs(total - beats) > 1e-9) {
      issues.push(`${where}, bar ${i + 1}: notes last ${total} beats, the bar has ${beats}`);
    }
    bar.notes.forEach((note, j) => {
      if ((note.string === undefined) !== (note.fret === undefined)) {
        issues.push(`${where}, bar ${i + 1}, note ${j + 1}: give both string and fret, or neither`);
      }
      if (note.finger !== undefined && !note.fret) {
        issues.push(`${where}, bar ${i + 1}, note ${j + 1}: a finger needs a fretted note`);
      }
    });
  });
}

export const exerciseCatalogSchema = catalogShape.check(
  z.superRefine((catalog, ctx) => {
    const issues: string[] = [];
    const ids = new Set<string>();
    for (const exercise of catalog.exercises) {
      if (ids.has(exercise.id)) issues.push(`duplicate exercise id "${exercise.id}"`);
      ids.add(exercise.id);
      checkExercise(exercise, catalog.strumPatterns, issues);
    }
    issues.forEach((issue) => {
      ctx.addIssue(issue);
    });
  }),
);

function resolveExercise(exercise: ExerciseData, patterns: Record<string, string>): Exercise {
  const base: ExerciseBase = {
    id: exercise.id,
    title: exercise.title,
    description: exercise.description,
    skills: exercise.skills,
    timeSignature: exercise.timeSignature,
    tempo: exercise.tempo,
  };
  const repeat = <T>(bars: T[]): T[] =>
    Array.from({ length: exercise.repeat ?? 1 }, () => bars).flat();

  if (exercise.kind === 'chords') {
    return {
      ...base,
      kind: 'chords',
      bars: repeat(
        exercise.bars.map((bar) => ({
          chords: bar.chords,
          strum: resolvePattern(patterns, bar.strum ?? exercise.strum) ?? '',
        })),
      ),
    };
  }
  return {
    ...base,
    kind: 'notes',
    bars: repeat(
      exercise.bars.map((bar) => ({
        chord: bar.chord ?? null,
        notes: bar.notes.map((note) => ({
          beats: note.beats,
          string: note.string ?? null,
          fret: note.fret ?? null,
          finger: note.finger ?? null,
        })),
      })),
    ),
  };
}

export function parseExerciseCatalog(data: unknown): readonly Exercise[] {
  const result = exerciseCatalogSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid exercise catalog:\n${z.prettifyError(result.error)}`);
  }
  const { strumPatterns, exercises } = result.data;
  return exercises.map((exercise) => resolveExercise(exercise, strumPatterns));
}

export const EXERCISES = parseExerciseCatalog(exercisesJson);

export function findExercise(id: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}
