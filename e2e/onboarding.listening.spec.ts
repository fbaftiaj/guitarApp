import { expect, test } from '@playwright/test';
import { installFakeGuitarist } from './support/fakeGuitarist';
import { EM, follow, storedLatency } from './support/listening';

/**
 * First-launch setup end to end, with the fake guitarist strumming the
 * latency calibration. Runs in the "listening" project (playwright.config.ts).
 */

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGuitarist);
});

test('first launch: placement, microphone, calibration and tuning', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Get started' })).toBeVisible();

  await page.getByText('I know a few chords').click();
  await expect(page.getByText('Start at Stage 2: Open Chords I')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(
    page.getByRole('heading', { name: 'FretPath listens while you play' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Make timing scores fair' })).toBeFocused();
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

  await expect(page.getByRole('heading', { name: 'Tune your guitar' })).toBeFocused();
  await page.getByRole('button', { name: 'Open the tuner' }).click();
  await expect(page).toHaveURL(/\/tuner$/);
  await expect(page.getByRole('button', { name: 'Tap to tune' })).toBeVisible();

  // Setup is done for good, and the course starts at the chosen stage.
  await page.goto('/');
  await expect(page).toHaveURL(/\/tuner$/);
  await page.goto('/learn');
  await expect(page.getByText('Start here · Stage 2')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start the first lesson' })).toHaveAttribute(
    'href',
    '/learn/lesson/e-minor-chord/learn',
  );
  await page.goto('/profile');
  await expect(page.getByText('Beginner 2', { exact: true })).toBeVisible();
});

test('setup can be skipped and run again from Settings', async ({ page }) => {
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Skip setup' }).click();
  await expect(page).toHaveURL(/\/tuner$/);

  await page.goto('/profile/settings');
  await page.getByRole('link', { name: 'Run setup again' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('radio', { name: /I’ve never played/ })).toBeChecked();
});
