import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDB } from '@/storage/db';
import {
  ACTIVITY_STORAGE_KEY,
  MAX_STRETCH_SECONDS,
  useActivityStore,
  whenActivityHydrated,
} from './activityStore';

const noon = (day: number) => new Date(2026, 9, day, 12).getTime();

describe('useActivityStore', () => {
  beforeEach(async () => {
    await whenActivityHydrated();
    useActivityStore.setState({ days: {} });
  });

  it('adds playing time to the local day', () => {
    const { addPractice } = useActivityStore.getState();
    addPractice(30, noon(27));
    addPractice(45, noon(27));
    addPractice(10, noon(28));
    expect(useActivityStore.getState().days).toEqual({ '2026-10-27': 75, '2026-10-28': 10 });
  });

  it('ignores empty or invalid time and caps a single stretch', () => {
    const { addPractice } = useActivityStore.getState();
    addPractice(0, noon(27));
    addPractice(-5, noon(27));
    addPractice(Number.NaN, noon(27));
    addPractice(99_999, noon(28));
    expect(useActivityStore.getState().days).toEqual({ '2026-10-28': MAX_STRETCH_SECONDS });
  });

  it('persists to IndexedDB and drops invalid saved data', async () => {
    useActivityStore.getState().addPractice(60, noon(27));
    await vi.waitFor(async () => {
      expect(await (await getDB()).get('kv', ACTIVITY_STORAGE_KEY)).toEqual({
        state: { days: { '2026-10-27': 60 } },
        version: 1,
      });
    });

    await (
      await getDB()
    ).put('kv', { state: { days: { x: -1 } }, version: 1 }, ACTIVITY_STORAGE_KEY);
    await useActivityStore.persist.rehydrate();
    expect(useActivityStore.getState().days).toEqual({});
  });
});
