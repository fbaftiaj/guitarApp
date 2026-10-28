import { expect, type Page } from '@playwright/test';
import type { GuitarPart } from './fakeGuitarist';

/** Helpers for tests that play into the app with the fake guitarist. */

/** MIDI notes per string, 6th first: E minor. */
export const EM = [40, 47, 52, 55, 59, 64];

/** Plays `parts` on the clicks after the first `skipClicks`. Arm it before pressing Play. */
export async function follow(page: Page, skipClicks: number, parts: GuitarPart[]) {
  await page.evaluate(
    (plan) => {
      window.fakeGuitarist.follow(plan);
    },
    { skipClicks, parts },
  );
}

/** The latency saved in IndexedDB (settings are written asynchronously). */
export function storedLatency(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const request = indexedDB.open('fretpath');
        request.onsuccess = () => {
          const read = request.result.transaction('kv').objectStore('kv').get('settings');
          read.onsuccess = () => {
            const value = read.result as { state?: { latencyMs?: unknown } } | undefined;
            resolve(value?.state?.latencyMs ?? null);
          };
        };
      }),
  );
}

/** Runs the latency calibration with the fake guitarist and saves the result. */
export async function calibrate(page: Page): Promise<number> {
  await page.goto('/profile/settings/latency');
  await follow(
    page,
    4,
    Array.from({ length: 8 }, () => ({ midis: EM })),
  );
  await page.getByRole('button', { name: 'Start' }).click();
  const save = page.getByRole('button', { name: /^Save \d+ ms$/ });
  await expect(save).toBeVisible({ timeout: 20_000 });
  const latency = Number(/\d+/.exec((await save.textContent()) ?? '')?.[0]);
  await save.click();
  await expect.poll(() => storedLatency(page)).toBe(latency);
  return latency;
}
