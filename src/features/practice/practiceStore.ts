import { z } from 'zod/mini';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BusLevel, PracticeBus } from '@/audio/synth/practiceSynth';
import { MAX_TEMPO, MIN_TEMPO, type Exercise } from '@/content/exercises';
import { createIdbPersistStorage, mergeValidated, whenHydrated } from '@/storage/persistStorage';
import { clampTempo } from './engine/transport';

/**
 * Practice preferences: per exercise (tempo, loop, speed-up, wait mode) and
 * for the practicer as a whole (mix, labels, fretboard). Per-exercise entries
 * are validated against the exercise when read (see `resolveExercisePrefs`),
 * so an exercise that got shorter never restores a loop past its end.
 */

export interface LoopBars {
  /** 1-based, inclusive. */
  startBar: number;
  endBar: number;
}

export interface ExercisePrefs {
  tempo: number;
  speedUp: boolean;
  /** BPM added after each successful pass. */
  speedUpStep: number;
  /** Null when looping is off. */
  loop: LoopBars | null;
  waitMode: boolean;
}

export type LabelKey = 'chordNames' | 'fingers' | 'noteNames';
export type Mix = Record<PracticeBus, BusLevel>;

/** New exercises start at 60 % of the target tempo, speeding up to it. */
export const STARTING_TEMPO_RATIO = 0.6;
export const SPEED_UP_STEPS = [2, 5, 10] as const;
const DEFAULT_SPEED_UP_STEP = 5;

export function defaultExercisePrefs(exercise: Exercise): ExercisePrefs {
  return {
    tempo: clampTempo(exercise.tempo * STARTING_TEMPO_RATIO),
    speedUp: true,
    speedUpStep: DEFAULT_SPEED_UP_STEP,
    loop: null,
    waitMode: false,
  };
}

const exercisePrefsSchema = z.object({
  tempo: z.int().check(z.gte(MIN_TEMPO), z.lte(MAX_TEMPO)),
  speedUp: z.boolean(),
  speedUpStep: z.int().check(z.gte(1), z.lte(20)),
  loop: z.nullable(
    z.object({ startBar: z.int().check(z.gte(1)), endBar: z.int().check(z.gte(1)) }),
  ),
  waitMode: z.boolean(),
});

/** Saved preferences for `exercise`, or its defaults where they are missing or invalid. */
export function resolveExercisePrefs(saved: unknown, exercise: Exercise): ExercisePrefs {
  const parsed = exercisePrefsSchema.safeParse(saved);
  if (!parsed.success) return defaultExercisePrefs(exercise);
  const prefs = parsed.data;
  const bars = exercise.bars.length;
  const loopFits =
    prefs.loop !== null && prefs.loop.startBar <= prefs.loop.endBar && prefs.loop.endBar <= bars;
  return { ...prefs, loop: loopFits ? prefs.loop : null };
}

const busSchema = z.object({
  enabled: z.boolean(),
  volume: z.number().check(z.gte(0), z.lte(1)),
});

export const DEFAULT_MIX: Mix = {
  metronome: { enabled: true, volume: 0.8 },
  backing: { enabled: true, volume: 0.6 },
  guide: { enabled: false, volume: 0.7 },
};

export const DEFAULT_LABELS: Record<LabelKey, boolean> = {
  chordNames: true,
  fingers: true,
  noteNames: false,
};

const persistedPracticeSchema = z.object({
  exercises: z.catch(z.record(z.string(), z.unknown()), {}),
  mix: z.catch(
    z.object({
      metronome: z.catch(busSchema, DEFAULT_MIX.metronome),
      backing: z.catch(busSchema, DEFAULT_MIX.backing),
      guide: z.catch(busSchema, DEFAULT_MIX.guide),
    }),
    DEFAULT_MIX,
  ),
  labels: z.catch(
    z.object({
      chordNames: z.catch(z.boolean(), DEFAULT_LABELS.chordNames),
      fingers: z.catch(z.boolean(), DEFAULT_LABELS.fingers),
      noteNames: z.catch(z.boolean(), DEFAULT_LABELS.noteNames),
    }),
    DEFAULT_LABELS,
  ),
  fretboard: z.catch(z.boolean(), false),
  /** Listen with the microphone and score the playing. */
  listening: z.catch(z.boolean(), true),
});

export type PracticePreferences = z.infer<typeof persistedPracticeSchema>;

export const DEFAULT_PRACTICE_PREFERENCES: PracticePreferences = {
  exercises: {},
  mix: DEFAULT_MIX,
  labels: DEFAULT_LABELS,
  fretboard: false,
  listening: true,
};

interface PracticeState extends PracticePreferences {
  setExercisePrefs: (exerciseId: string, prefs: ExercisePrefs) => void;
  setBus: (bus: PracticeBus, level: Partial<BusLevel>) => void;
  setLabel: (label: LabelKey, shown: boolean) => void;
  setFretboard: (shown: boolean) => void;
  setListening: (listening: boolean) => void;
}

export const PRACTICE_STORAGE_KEY = 'practice';

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set) => ({
      ...DEFAULT_PRACTICE_PREFERENCES,
      setExercisePrefs: (exerciseId, prefs) => {
        set((state) => ({ exercises: { ...state.exercises, [exerciseId]: prefs } }));
      },
      setBus: (bus, level) => {
        set((state) => {
          const next = { ...state.mix[bus], ...level };
          next.volume = Math.min(1, Math.max(0, Number.isFinite(next.volume) ? next.volume : 0));
          return { mix: { ...state.mix, [bus]: next } };
        });
      },
      setLabel: (label, shown) => {
        set((state) => ({ labels: { ...state.labels, [label]: shown } }));
      },
      setFretboard: (fretboard) => {
        set({ fretboard });
      },
      setListening: (listening) => {
        set({ listening });
      },
    }),
    {
      name: PRACTICE_STORAGE_KEY,
      version: 1,
      storage: createIdbPersistStorage<PracticePreferences>(),
      partialize: ({ exercises, mix, labels, fretboard, listening }): PracticePreferences => ({
        exercises,
        mix,
        labels,
        fretboard,
        listening,
      }),
      merge: mergeValidated(persistedPracticeSchema),
    },
  ),
);

/** Resolves once the saved practice preferences have loaded (or after a timeout). */
export function whenPracticeHydrated(): Promise<void> {
  return whenHydrated(usePracticeStore.persist);
}
