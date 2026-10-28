import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installFakeGuitarist } from './support/fakeGuitarist';
import { EM, calibrate, follow } from './support/listening';
import { withOptions } from './support/practicer';

/**
 * Listening and scoring end to end: a fake guitarist plays synthesised
 * strums and notes into the real analysis worklet, timed on the app's audio
 * clock against the clicks it schedules.
 */

// Runs in the "listening" project: one test at a time, after the others (see
// playwright.config.ts), so other tests' audio does not compete for the CPU.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGuitarist);
});

const E = [40, 47, 52, 56, 59, 64];
const AM = [null, 45, 52, 57, 60, 64];

async function openExercise(page: Page, id: string) {
  await page.goto(`/practice/${id}`);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
}

test('measures latency by playing along with the clicks', async ({ page }) => {
  await page.goto('/profile/settings/latency');
  await expect(page.getByText('Not measured yet')).toBeVisible();
  const latency = await calibrate(page);
  expect(latency).toBeGreaterThanOrEqual(0);
  expect(latency).toBeLessThan(120);
  await expect(page.getByText(`Measured latency: ${latency} ms`)).toBeVisible();

  await page.goto('/profile/settings');
  await expect(page.getByText(`Measured latency: ${latency} ms.`)).toBeVisible();
});

test('asks for another go when nothing is played', async ({ page }) => {
  await page.goto('/profile/settings/latency');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByText(/heard 0 of 8 beats/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('scores strums: timing, right and wrong chords, misses, then the results', async ({
  page,
}) => {
  await calibrate(page);
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: '75%' }).click(); // 60 BPM: a beat a second
  await withOptions(page, (options) =>
    options.getByRole('switch', { name: 'Auto speed-up' }).click(),
  );
  // Arm the guitarist before playing, so it counts the count-in from its first click.
  await follow(page, 4, [
    { midis: EM },
    { midis: EM },
    { midis: EM, offsetMs: 60 }, // good
    { midis: EM },
    { midis: E }, // wrong chord, on time
    { midis: AM, offsetMs: 130 }, // late
    null, // missed
    { midis: AM },
  ]);
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  // Finish just after the last strum (scheduled 0.1 s ahead), a second before bar 3.
  await expect
    .poll(() => page.evaluate(() => window.fakeGuitarist.played()), {
      timeout: 20_000,
      intervals: [50],
    })
    .toBe(7);
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Finish and see results' }).click();

  const results = page.getByRole('dialog', { name: 'Results' });
  await expect(results).toBeVisible();
  const count = (label: string) =>
    results.locator('dl > div', { has: page.getByText(label, { exact: true }) }).locator('dd');
  await expect(count('Perfect')).toHaveText('5');
  await expect(count('Good')).toHaveText('1');
  await expect(count('Early')).toHaveText('0');
  await expect(count('Late')).toHaveText('1');
  await expect(count('Miss')).toHaveText('1');
  await expect(results.getByText('1 played on time with the wrong chord or note')).toBeVisible();
  await expect(results.getByText('Missed most')).toBeVisible();
  await expect(results.getByRole('listitem').first()).toHaveText('Am × 2');
  // Four Perfect, one Good and one Late with the right chord, of eight: (4 + 0.85 + 0.5) / 8.
  await expect(results.getByText('67%')).toBeVisible();
  await expect(results.getByRole('img', { name: '0 of 3 stars' })).toBeVisible();
  await expect(results.getByText('Try again at 50 BPM')).toBeVisible();
  await expect(results.getByRole('img', { name: /^Timing chart/ })).toBeVisible();

  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);

  const stored = await page.evaluate(
    () =>
      new Promise<unknown[]>((resolve, reject) => {
        const request = indexedDB.open('fretpath');
        request.onsuccess = () => {
          const all = request.result.transaction('sessions').objectStore('sessions').getAll();
          all.onsuccess = () => {
            resolve(all.result as unknown[]);
          };
        };
        request.onerror = () => {
          reject(new Error('no db'));
        };
      }),
  );
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({
    exerciseId: 'em-am-changes',
    mode: 'practice',
    bpm: 60,
    hits: { perfect: 5, good: 1, early: 0, late: 1, miss: 1 },
    missed: { Am: 2 },
  });

  await results.getByRole('button', { name: 'Play at 50 BPM' }).click();
  await expect(results).toBeHidden();
  await expect(page.getByRole('slider', { name: 'Tempo' })).toHaveValue('50');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});

test('wait for me carries on when it hears the right chord', async ({ page }) => {
  await calibrate(page);
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: '125%' }).click(); // 100 BPM
  await page.getByRole('switch', { name: 'Wait for me' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  await expect(page.getByText('Waiting for E minor. Play it to carry on.')).toBeAttached();
  await expect(page.getByText('Listening… play it to carry on.')).toBeVisible();
  const playNow = (midis: (number | null)[]) =>
    page.evaluate((chord) => {
      window.fakeGuitarist.playNow({ midis: chord });
    }, midis);

  await playNow(E);
  await expect(page.getByText('Not quite. Try again.')).toBeVisible();
  await expect(page.getByText('Bar 1 / 8')).toBeVisible();

  await playNow(EM);
  await expect(page.getByText('Waiting for A minor. Play it to carry on.')).toBeAttached({
    timeout: 5000,
  });
  await expect(page.getByText('Bar 2 / 8')).toBeVisible();
  await expect(page.getByText('Listening… play it to carry on.')).toBeVisible();

  await playNow(AM);
  await expect(page.getByText('Waiting for E minor. Play it to carry on.')).toBeAttached({
    timeout: 5000,
  });
  await expect(page.getByText('Bar 3 / 8')).toBeVisible();

  await page.getByRole('button', { name: 'Finish and see results' }).click();
  const results = page.getByRole('dialog', { name: 'Results' });
  // Two chords waited for, one right first time; the third was still awaited.
  await expect(results.getByText('accuracy over 3 targets')).toBeVisible();
  await expect(results.getByText('33%')).toBeVisible();
});

test('scores single notes by pitch', async ({ page }) => {
  await calibrate(page);
  await openExercise(page, 'open-strings');
  await page.getByRole('button', { name: '75%' }).click(); // 60 BPM
  await withOptions(page, (options) =>
    options.getByRole('switch', { name: 'Auto speed-up' }).click(),
  );
  await follow(page, 4, [
    { midi: 40 },
    { midi: 41 }, // F2 instead of A2
    { midi: 50 },
    { midi: 55 },
  ]);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.fakeGuitarist.played()), {
      timeout: 15_000,
      intervals: [50],
    })
    .toBe(4);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Finish and see results' }).click();

  const results = page.getByRole('dialog', { name: 'Results' });
  await expect(results.getByText('accuracy over 4 targets')).toBeVisible();
  await expect(results.getByText('1 played on time with the wrong chord or note')).toBeVisible();
  await expect(results.getByRole('listitem').first()).toHaveText('A2 × 1');
});

test('speeds up only after a pass played well', async ({ page }) => {
  await calibrate(page);
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: '75%' }).click(); // 60 BPM
  await withOptions(page, async (options) => {
    await options.getByRole('switch', { name: 'Loop' }).click();
    await options.getByRole('combobox', { name: 'Loop to bar' }).selectOption('1');
    await options.getByText('+10', { exact: true }).click();
  });
  // Pass 1 played right, pass 2 not played at all.
  await follow(
    page,
    4,
    Array.from({ length: 4 }, () => ({ midis: EM })),
  );
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  const tempo = page.getByRole('slider', { name: 'Tempo' });
  await expect(tempo).toHaveValue('70', { timeout: 15_000 });
  await expect(page.getByText(/Loop 2 ·/)).toBeVisible();
  // Pass 2 at 70 BPM is all misses: no more speed-up.
  await expect(page.getByText(/Loop 3 ·/)).toBeVisible({ timeout: 10_000 });
  await expect(tempo).toHaveValue('70');
  await page.getByRole('button', { name: 'Pause' }).click();
});

test('explains a blocked microphone and can play without listening', async ({ page }) => {
  await openExercise(page, 'em-am-changes');
  await page.evaluate(() => {
    window.fakeGuitarist.failNextWith('NotAllowedError');
  });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'Microphone access is blocked' });
  await expect(alert).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  await alert.getByRole('button', { name: 'Play without listening' }).click();
  await withOptions(page, async (options) => {
    await expect(options.getByRole('switch', { name: 'Listen and score' })).not.toBeChecked();
  });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  expect(await page.evaluate(() => window.fakeGuitarist.isLive())).toBe(false);
});

test('releases the microphone soon after pausing', async ({ page }) => {
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.fakeGuitarist.isLive())).toBe(true);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect.poll(() => page.evaluate(() => window.fakeGuitarist.isLive())).toBe(false);

  await page.getByRole('button', { name: 'Resume' }).click();
  await expect.poll(() => page.evaluate(() => window.fakeGuitarist.isLive())).toBe(true);
  await page.getByRole('link', { name: 'All exercises' }).first().click();
  await expect.poll(() => page.evaluate(() => window.fakeGuitarist.isLive())).toBe(false);
});
