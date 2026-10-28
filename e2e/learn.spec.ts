import { expect, test } from '@playwright/test';
import { installAudioSpy } from './support/audioSpy';
import { withOptions } from './support/practicer';

/** The course: stages, lessons, unlocking and the Learn and Listen steps. */

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installAudioSpy);
});

test('takes a new player from the course overview into the first lesson', async ({ page }) => {
  await page.goto('/learn');
  const stages = page.getByRole('list', { name: 'Stages' }).getByRole('listitem');
  await expect(stages).toHaveCount(8);
  await expect(stages.nth(1)).toContainText('Pass the Stage 1 test to unlock');
  await expect(stages.nth(7)).toContainText('Coming soon');

  await page.getByRole('link', { name: /Stage 1: First Steps/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Stage 1: First Steps' })).toBeVisible();
  await expect(page.getByText('0 of 15 lessons')).toBeVisible();
  // Only the first lesson is open.
  await expect(page.getByRole('link', { name: /Sitting with the guitar/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Parts of the guitar.*up next/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Parts of the guitar' })).toBeVisible();
  await expect(page).toHaveURL(/\/learn\/lesson\/parts-of-the-guitar\/learn$/);
  await expect(
    page.getByRole('navigation', { name: 'Lesson steps' }).getByRole('link', { name: /Learn/ }),
  ).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('img', { name: /A guitar with its parts labelled/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Common mistakes' })).toBeVisible();
});

test('the fretboard demo plays by itself and can be stepped through', async ({ page }) => {
  await page.goto('/learn/lesson/parts-of-the-guitar/learn');
  const demo = page.getByRole('img', { name: /^Demo step/ });
  await expect(demo).toHaveAttribute('aria-label', /^Demo step 1 of 4: string 6 \(low E\), open/);
  // At 45 BPM (75 % of 60), the demo moves on every 1.33 s.
  await expect(demo).toHaveAttribute('aria-label', /^Demo step 2 of 4/, { timeout: 3_000 });

  await page.getByRole('button', { name: 'Pause demo' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(demo).toHaveAttribute('aria-label', /^Demo step 3 of 4/);
  await page.getByRole('button', { name: 'Previous step' }).click();
  await page.getByRole('button', { name: 'Previous step' }).click();
  await page.getByRole('button', { name: 'Previous step' }).click();
  await expect(demo).toHaveAttribute('aria-label', /^Demo step 4 of 4/);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the demo waits to be played', async ({ page }) => {
    await page.goto('/learn/lesson/parts-of-the-guitar/learn');
    await expect(page.getByRole('button', { name: 'Play demo' })).toBeVisible();
    await page.waitForTimeout(1_600);
    await expect(page.getByRole('img', { name: /^Demo step 1 of 4/ })).toBeVisible();
  });
});

test('Listen plays the exercise with the guide at the target tempo', async ({ page }) => {
  // Backing off, so every buffer source is a guide note; the guide is off by default,
  // and Listen turns it on.
  await page.goto('/practice/open-strings');
  await withOptions(page, (options) =>
    options.getByRole('switch', { name: 'Backing track' }).click(),
  );
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Learn' }).click();
  await page.getByRole('link', { name: 'Start the first lesson' }).click();
  await page.getByRole('link', { name: 'Next: Listen' }).click();
  await expect(page.getByText(/target tempo, 60 BPM/)).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  // The count-in (4 clicks at 60 BPM), then the guide plucks the low E on each beat.
  await expect(page.getByText('Bar 2 / 4')).toBeVisible({ timeout: 10_000 });
  const sounds = await page.evaluate(() => window.audioSpy.started);
  const clicks = sounds.filter((s) => s.kind === 'oscillator' && s.frequency >= 1000);
  const notes = [...new Set(sounds.filter((s) => s.kind === 'buffer').map((s) => s.when))];
  expect(notes.length).toBeGreaterThanOrEqual(4);
  notes.slice(0, 4).forEach((when, beat) => {
    expect(when - (clicks[4]?.when ?? 0)).toBeCloseTo(beat, 6);
  });
  await page.getByRole('button', { name: 'Pause' }).click();
});

test('locked lessons stay closed and point to the lesson to play', async ({ page }) => {
  await page.goto('/learn/lesson/holding-the-pick/check');
  await expect(page.getByText('This lesson is locked')).toBeVisible();
  await expect(page.getByText('Pass “Sitting with the guitar” to unlock it.')).toBeVisible();
  await page.getByRole('link', { name: 'Go to “Parts of the guitar”' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Parts of the guitar' })).toBeVisible();

  await page.goto('/learn/stage/open-chords-1');
  await expect(page.getByText('Pass the Stage 1 test to unlock this stage.')).toBeVisible();
  await expect(page.getByRole('link', { name: /E minor \(Em\)/ })).toHaveCount(0);
});

test('songs open in the practicer with their chart', async ({ page }) => {
  await page.goto('/songs');
  await page.getByRole('link', { name: /Auld Lang Syne/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Auld Lang Syne' })).toBeVisible();
  await expect(page.getByText(/Traditional · Traditional Scottish melody/)).toBeVisible();

  await page.getByText('Song chart').click();
  await expect(page.getByText('Form: Verse → Chorus')).toBeVisible();
  await expect(page.getByRole('listitem', { name: 'Bar 7: C then D' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});
