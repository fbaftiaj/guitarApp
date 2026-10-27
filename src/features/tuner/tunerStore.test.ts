import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDB } from '@/storage/db';
import {
  DEFAULT_TUNER_PREFERENCES,
  TUNER_STORAGE_KEY,
  useTunerStore,
  whenTunerHydrated,
} from './tunerStore';

describe('useTunerStore', () => {
  beforeEach(async () => {
    await whenTunerHydrated();
    useTunerStore.setState(DEFAULT_TUNER_PREFERENCES);
  });

  it('remembers the last tuning of each instrument', () => {
    const { selectTuning, selectInstrument } = useTunerStore.getState();
    selectTuning('drop-d');
    selectInstrument('bass-4');
    selectTuning('half-step-down');

    expect(useTunerStore.getState().tuningByInstrument).toEqual({
      'guitar-6': 'drop-d',
      'bass-4': 'half-step-down',
    });
  });

  it('saves the preferences to IndexedDB', async () => {
    useTunerStore.getState().setMode('chromatic');

    await vi.waitFor(async () => {
      expect(await (await getDB()).get('kv', TUNER_STORAGE_KEY)).toMatchObject({
        state: { mode: 'chromatic', instrumentId: 'guitar-6' },
      });
    });
  });

  it('falls back field by field when saved values are invalid', async () => {
    await (
      await getDB()
    ).put(
      'kv',
      {
        state: { instrumentId: 42, tuningByInstrument: 'x', bodyStyle: 'banjo', mode: 'auto' },
        version: 1,
      },
      TUNER_STORAGE_KEY,
    );

    await useTunerStore.persist.rehydrate();

    expect(useTunerStore.getState()).toMatchObject(DEFAULT_TUNER_PREFERENCES);
  });
});
