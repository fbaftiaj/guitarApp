import { expect, test, type Page } from '@playwright/test';
import { installFakeGuitarist, type GuitarPart } from './support/fakeGuitarist';
import { EM } from './support/listening';

/**
 * The chord trainer with the fake guitarist: no clicks to follow, so each
 * string or strum is played as soon as the screen asks for it. Runs in the
 * "listening" project (playwright.config.ts).
 */

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGuitarist);
});

const E_MAJOR = [40, 47, 52, 56, 59, 64];
const A_MINOR = [null, 45, 52, 57, 60, 64];

async function play(page: Page, part: Exclude<GuitarPart, null>) {
  await page.evaluate((sound) => {
    window.fakeGuitarist.playNow(sound);
  }, part);
}

const instruction = (page: Page) => page.locator('main p.text-2xl');
const feedback = (page: Page) => page.getByRole('status');

async function start(page: Page, path: string) {
  await page.goto(path);
  await page.getByRole('button', { name: 'Start listening' }).click();
  await expect(page.getByText('Listening', { exact: true })).toBeVisible();
}

test('learns a chord string by string, then strums it', async ({ page }) => {
  await start(page, '/trainer?chords=Em&learn=1');
  await expect(page.getByRole('heading', { level: 1, name: 'Learn Em' })).toBeVisible();
  await expect(instruction(page)).toHaveText('Play string 6 (low E)');

  // A string of the chord, but the wrong one: it says which one it heard.
  await play(page, { midi: 47 });
  await expect(feedback(page)).toHaveText('That was B, string 5 (A). Now pick string 6 (low E).');
  // A note the chord doesn't use at all.
  await page.waitForTimeout(350);
  await play(page, { midi: 45 });
  await expect(feedback(page)).toHaveText(
    'That was A, not the note this string makes. Check the finger and fret.',
  );

  const strings = [
    [40, 'Play string 5 (A)'],
    [47, 'Play string 4 (D)'],
    [52, 'Play string 3 (G)'],
    [55, 'Play string 2 (B)'],
    [59, 'Play string 1 (high e)'],
    [64, 'Now strum E minor'],
  ] as const;
  for (const [midi, next] of strings) {
    await page.waitForTimeout(350);
    await play(page, { midi });
    await expect(instruction(page)).toHaveText(next);
  }
  await expect(page.getByRole('img', { name: /^E minor chord:/ })).toBeVisible();

  for (let i = 1; i <= 3; i++) {
    await page.waitForTimeout(350);
    await play(page, { midis: EM });
    if (i < 3) await expect(page.getByRole('list', { name: `${i} of 3 strums` })).toBeVisible();
  }
  await expect(page.getByText('Well played!')).toBeVisible();
  // The microphone is released at the end.
  await expect.poll(() => page.evaluate(() => window.fakeGuitarist.isLive())).toBe(false);
});

test('waits for each chord change, explains a wrong chord and times the changes', async ({
  page,
}) => {
  await start(page, '/trainer?chords=Em,Am&learn=0&back=/practice');
  await expect(instruction(page)).toHaveText('Play E minor');
  await expect(page.getByText('Next', { exact: true })).toBeVisible();

  await play(page, { midis: E_MAJOR });
  await expect(feedback(page)).toHaveText(
    'That sounded like E major. Check each finger and try again.',
  );

  for (let change = 0; change < 8; change++) {
    await page.waitForTimeout(350);
    const em = change % 2 === 0;
    await play(page, { midis: em ? EM : A_MINOR });
    if (change < 7) {
      await expect(instruction(page)).toHaveText(em ? 'Play A minor' : 'Play E minor');
    }
    // The praise names the chord just played, not the next one.
    if (change === 0) await expect(feedback(page)).toHaveText('Yes! That’s E minor.');
  }
  const summary = page.getByRole('status').filter({ hasText: 'Well played!' });
  await expect(summary).toBeVisible();
  await expect(summary.getByText('Average change')).toBeVisible();
  await expect(summary.getByText('Tries that missed').locator('..')).toContainText('1');

  await summary.getByRole('link', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/practice$/);
});

test('opens from the Practice tab and closes back to it', async ({ page }) => {
  await page.goto('/practice');
  await page.getByRole('link', { name: 'Change between G – C', exact: true }).click();
  await expect(page).toHaveURL(/\/trainer\?chords=G%2CC&learn=0/);
  await expect(page.getByRole('heading', { level: 1, name: 'G – C' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Close' }).click();
  await expect(page).toHaveURL(/\/practice$/);
});
