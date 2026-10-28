import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDB } from '@/storage/db';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  useSettingsStore,
  whenSettingsHydrated,
} from './settingsStore';

async function storeRaw(value: unknown): Promise<void> {
  await (await getDB()).put('kv', value, SETTINGS_STORAGE_KEY);
}

describe('useSettingsStore', () => {
  beforeEach(async () => {
    await whenSettingsHydrated();
    useSettingsStore.setState(DEFAULT_SETTINGS);
  });

  it('defaults to the dark theme', () => {
    expect(useSettingsStore.getState().theme).toBe('dark');
  });

  it('persists changes to IndexedDB', async () => {
    useSettingsStore.getState().setTheme('light');

    await vi.waitFor(async () => {
      expect(await (await getDB()).get('kv', SETTINGS_STORAGE_KEY)).toEqual({
        state: {
          theme: 'light',
          referencePitch: 440,
          latencyMs: null,
          onboarded: false,
          startStage: 1,
        },
        version: 1,
      });
    });
  });

  it('restores saved settings', async () => {
    await storeRaw({ state: { theme: 'system' }, version: 1 });

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().theme).toBe('system');
  });

  it.each([
    ['an unknown value', { state: { theme: 'neon' }, version: 1 }],
    ['a missing value', { state: {}, version: 1 }],
  ])('falls back to the default theme for %s', async (_case, stored) => {
    useSettingsStore.setState({ theme: 'light' });
    await storeRaw(stored);

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().theme).toBe(DEFAULT_SETTINGS.theme);
  });

  it('stores a measured latency, rounded and within range', () => {
    const { setLatency } = useSettingsStore.getState();
    setLatency(71.6);
    expect(useSettingsStore.getState().latencyMs).toBe(72);
    setLatency(900);
    expect(useSettingsStore.getState().latencyMs).toBe(500);
    setLatency(-5);
    expect(useSettingsStore.getState().latencyMs).toBe(0);
    setLatency(null);
    expect(useSettingsStore.getState().latencyMs).toBeNull();
  });

  it('finishes onboarding at a valid starting stage', () => {
    const { completeOnboarding } = useSettingsStore.getState();
    completeOnboarding(3);
    expect(useSettingsStore.getState()).toMatchObject({ onboarded: true, startStage: 3 });
    completeOnboarding(42);
    expect(useSettingsStore.getState().startStage).toBe(8);
    completeOnboarding(Number.NaN);
    expect(useSettingsStore.getState().startStage).toBe(1);
  });

  it('starts at stage 1 when the saved placement is invalid', async () => {
    await storeRaw({ state: { onboarded: true, startStage: 0 }, version: 1 });
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({ onboarded: true, startStage: 1 });
  });

  it('forgets an invalid saved latency', async () => {
    await storeRaw({ state: { latencyMs: 'fast', theme: 'light' }, version: 1 });
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({ latencyMs: null, theme: 'light' });
  });

  it('ignores saved state that is not an object', async () => {
    useSettingsStore.setState({ theme: 'light' });
    await storeRaw({ state: 'corrupted', version: 1 });

    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().theme).toBe('light');
  });
});

describe('whenSettingsHydrated', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves once hydration has finished', async () => {
    await useSettingsStore.persist.rehydrate();

    await expect(whenSettingsHydrated()).resolves.toBeUndefined();
  });

  it('gives up after the timeout if hydration never finishes', async () => {
    vi.useFakeTimers();
    vi.spyOn(useSettingsStore.persist, 'hasHydrated').mockReturnValue(false);
    vi.spyOn(useSettingsStore.persist, 'onFinishHydration').mockReturnValue(() => undefined);

    const settled = vi.fn();
    void whenSettingsHydrated(1_000).then(settled);

    await vi.advanceTimersByTimeAsync(999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalled();
  });
});
