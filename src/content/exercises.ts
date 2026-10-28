import { z } from 'zod/mini';
import { skillIdSchema, type SkillId } from '@/storage/types';
import { CHORDS } from './chords';
import exercisesJson from './exercises.json';
import { parseOrThrow, report, slug, text } from './schemaParts';
import strumPatternsJson from './strumPatterns.json';

/**
 * Play-along exercises, validated when the module loads. A strum pattern has
 * one character per slot — an eighth note in x/4 time, a beat in x/8 time:
 * "D" down, "U" up, "." no strum. Patterns may be named (strumPatterns.json).
 *
 * The music of an exercise (time signature, tempo, bars) has its own schema,
 * reused by lessons and songs, which supply the title and skills themselves.
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

export interface ExerciseMeta {
  id: string;
  title: string;
  description: string;
  skills: readonly SkillId[];
}

interface ExerciseBase extends ExerciseMeta {
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

const patternText = z.string().check(z.regex(/^[DU.]+$/));

export const STRUM_PATTERNS: Readonly<Record<string, string>> = parseOrThrow(
  z.record(slug, patternText),
  strumPatternsJson,
  'strum patterns',
);

export const timeSignatureSchema = z.object({
  beats: z.int().check(z.gte(2), z.lte(12)),
  unit: z.union([z.literal(4), z.literal(8)]),
});

export const tempoSchema = z.int().check(z.gte(MIN_TEMPO), z.lte(MAX_TEMPO));

const musicCommon = {
  timeSignature: timeSignatureSchema,
  tempo: tempoSchema,
  /** Plays the bars this many times. */
  repeat: z.optional(z.int().check(z.gte(1), z.lte(16))),
};

export const chordBarSchema = z.object({
  chords: z.array(z.string()).check(z.minLength(1), z.maxLength(4)),
  strum: z.optional(z.string()),
});

const chordMusic = {
  ...musicCommon,
  kind: z.literal('chords'),
  strum: z.string(),
  bars: z.array(chordBarSchema).check(z.minLength(1)),
};

export const noteBarSchema = z.object({
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
});

const noteMusic = {
  ...musicCommon,
  kind: z.literal('notes'),
  bars: z.array(noteBarSchema).check(z.minLength(1)),
};

/** The music of an exercise, without its title and skills. */
export const musicSchema = z.discriminatedUnion('kind', [
  z.object(chordMusic),
  z.object(noteMusic),
]);
export type MusicData = z.infer<typeof musicSchema>;

const meta = {
  id: slug,
  title: text,
  description: text,
  skills: z.array(skillIdSchema).check(z.minLength(1)),
};

const exerciseDataSchema = z.discriminatedUnion('kind', [
  z.object({ ...meta, ...chordMusic }),
  z.object({ ...meta, ...noteMusic }),
]);

function resolvePattern(value: string): string | null {
  const pattern = STRUM_PATTERNS[value] ?? value;
  return /^[DU.]+$/.test(pattern) ? pattern : null;
}

/** Content checks a schema cannot express; `where` prefixes each issue, e.g. `exercise "x"`. */
export function checkMusic(music: MusicData, where: string, issues: string[]): void {
  const { beats } = music.timeSignature;
  const slots = beats * slotsPerBeat(music.timeSignature);
  const checkChord = (id: string, bar: number) => {
    if (!CHORDS.has(id)) issues.push(`${where}, bar ${bar}: unknown chord "${id}"`);
  };

  if (music.kind === 'chords') {
    music.bars.forEach((bar, i) => {
      bar.chords.forEach((id) => {
        checkChord(id, i + 1);
      });
      if (beats % bar.chords.length !== 0) {
        issues.push(
          `${where}, bar ${i + 1}: ${bar.chords.length} chords do not split ${beats} beats`,
        );
      }
      const strum = bar.strum ?? music.strum;
      const pattern = resolvePattern(strum);
      if (pattern === null) issues.push(`${where}, bar ${i + 1}: unknown strum pattern "${strum}"`);
      else if (pattern.length !== slots) {
        issues.push(
          `${where}, bar ${i + 1}: strum "${strum}" has ${pattern.length} slots, needs ${slots}`,
        );
      }
    });
    return;
  }

  music.bars.forEach((bar, i) => {
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

/** An exercise from validated music: named strum patterns resolved, repeats expanded. */
export function buildExercise(info: ExerciseMeta, music: MusicData): Exercise {
  const base: ExerciseBase = {
    id: info.id,
    title: info.title,
    description: info.description,
    skills: info.skills,
    timeSignature: music.timeSignature,
    tempo: music.tempo,
  };
  const repeat = <T>(bars: T[]): T[] =>
    Array.from({ length: music.repeat ?? 1 }, () => bars).flat();

  if (music.kind === 'chords') {
    return {
      ...base,
      kind: 'chords',
      bars: repeat(
        music.bars.map((bar) => ({
          chords: bar.chords,
          strum: resolvePattern(bar.strum ?? music.strum) ?? '',
        })),
      ),
    };
  }
  return {
    ...base,
    kind: 'notes',
    bars: repeat(
      music.bars.map((bar) => ({
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

export const exerciseCatalogSchema = z
  .object({ exercises: z.array(exerciseDataSchema).check(z.minLength(1)) })
  .check(
    z.superRefine((catalog, ctx) => {
      const issues: string[] = [];
      const ids = new Set<string>();
      for (const exercise of catalog.exercises) {
        if (ids.has(exercise.id)) issues.push(`duplicate exercise id "${exercise.id}"`);
        ids.add(exercise.id);
        checkMusic(exercise, `exercise "${exercise.id}"`, issues);
      }
      report(issues, ctx);
    }),
  );

export function parseExerciseCatalog(data: unknown): readonly Exercise[] {
  const { exercises } = parseOrThrow(exerciseCatalogSchema, data, 'exercise catalog');
  return exercises.map((exercise) => buildExercise(exercise, exercise));
}

export const EXERCISES = parseExerciseCatalog(exercisesJson);

export function findExercise(id: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}
