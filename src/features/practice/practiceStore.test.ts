import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findExercise, type Exercise } from '@/content/exercises';
import { getDB } from '@/storage/db';
import {
  DEFAULT_MIX,
  DEFAULT_PRACTICE_PREFERENCES,
  PRACTICE_STORAGE_KEY,
  defaultExercisePrefs,
  resolveExercisePrefs,
  usePracticeStore,
  whenPracticeHydrated,
} from './practiceStore';

function exercise(id: string): Exercise {
  const found = findExercise(id);
  if (!found) throw new Error(`missing exercise ${id}`);
  return found;
}

describe('practice preferences', () => {
  beforeEach(async () => {
    await whenPracticeHydrated();
    usePracticeStore.setState(DEFAULT_PRACTICE_PREFERENCES);
  });

  it('starts new exercises at 60 % of the target tempo, speeding up', () => {
    expect(defaultExercisePrefs(exercise('g-c-d-folk'))).toEqual({
      tempo: 54,
      speedUp: true,
      speedUpStep: 5,
      loop: null,
      waitMode: false,
    });
  });

  it('falls back to the defaults for missing or invalid saved values', () => {
    const em = exercise('em-am-changes');
    expect(resolveExercisePrefs(undefined, em)).toEqual(defaultExercisePrefs(em));
    expect(resolveExercisePrefs({ tempo: 'fast' }, em)).toEqual(defaultExercisePrefs(em));
    const saved = { ...defaultExercisePrefs(em), tempo: 70, loop: { startBar: 3, endBar: 4 } };
    expect(resolveExercisePrefs(saved, em)).toEqual(saved);
  });

  it('drops a saved loop that no longer fits the exercise', () => {
    const waltz = exercise('am-e-waltz');
    const prefs = defaultExercisePrefs(waltz);
    expect(resolveExercisePrefs({ ...prefs, loop: { startBar: 7, endBar: 12 } }, waltz).loop).toBe(
      null,
    );
    expect(resolveExercisePrefs({ ...prefs, loop: { startBar: 4, endBar: 2 } }, waltz).loop).toBe(
      null,
    );
  });

  it('keeps volumes in range', () => {
    const { setBus } = usePracticeStore.getState();
    setBus('guide', { enabled: true });
    setBus('metronome', { volume: 1.7 });
    setBus('backing', { volume: Number.NaN });
    expect(usePracticeStore.getState().mix).toEqual({
      metronome: { enabled: true, volume: 1 },
      backing: { enabled: true, volume: 0 },
      guide: { enabled: true, volume: DEFAULT_MIX.guide.volume },
    });
  });

  it('saves per-exercise preferences to IndexedDB', async () => {
    const prefs = { ...defaultExercisePrefs(exercise('em-am-changes')), tempo: 66 };
    usePracticeStore.getState().setExercisePrefs('em-am-changes', prefs);
    usePracticeStore.getState().setLabel('noteNames', true);

    await vi.waitFor(async () => {
      expect(await (await getDB()).get('kv', PRACTICE_STORAGE_KEY)).toMatchObject({
        state: { exercises: { 'em-am-changes': prefs }, labels: { noteNames: true } },
      });
    });
  });

  it('falls back field by field when saved values are invalid', async () => {
    await (
      await getDB()
    ).put(
      'kv',
      {
        state: {
          exercises: 'nope',
          mix: { metronome: { enabled: 'yes', volume: 2 }, backing: DEFAULT_MIX.backing },
          labels: { chordNames: false, fingers: 3 },
          fretboard: true,
        },
        version: 1,
      },
      PRACTICE_STORAGE_KEY,
    );

    await usePracticeStore.persist.rehydrate();

    expect(usePracticeStore.getState()).toMatchObject({
      exercises: {},
      mix: DEFAULT_MIX,
      labels: { chordNames: false, fingers: true, noteNames: false },
      fretboard: true,
      listening: true,
    });
  });
});
