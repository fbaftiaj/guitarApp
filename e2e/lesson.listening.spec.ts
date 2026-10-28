import { expect, test, type Page } from '@playwright/test';
import { installFakeGuitarist } from './support/fakeGuitarist';
import { calibrate, follow } from './support/listening';

/**
 * Completing a lesson end to end: the fake guitarist plays the first
 * lesson's check (open low E on every beat) into the real analysis worklet.
 * Runs in the "listening" project, one test at a time (playwright.config.ts).
 */

test.use({ serviceWorkers: 'block' });
// A check plays the whole exercise in real time: 20 s, plus calibration.
test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGuitarist);
});

/** The first lesson's exercise: four bars of the open low E on every beat. */
const LOW_E = 40;
const FIRST_LESSON_NOTES = 16;

interface StoredProgress {
  lessons: { lessonId: string; stars: number; attempts: number }[];
  checks: { lessonId: string | null; mode: string }[];
}

function storedProgress(page: Page): Promise<StoredProgress> {
  return page.evaluate(
    () =>
      new Promise<StoredProgress>((resolve) => {
        const request = indexedDB.open('fretpath');
        request.onsuccess = () => {
          const tx = request.result.transaction(['lessonProgress', 'sessions']);
          const lessons = tx.objectStore('lessonProgress').getAll();
          const sessions = tx.objectStore('sessions').getAll();
          tx.oncomplete = () => {
            resolve({
              lessons: lessons.result as StoredProgress['lessons'],
              checks: (sessions.result as StoredProgress['checks']).filter(
                (session) => session.mode === 'check',
              ),
            });
          };
        };
      }),
  );
}

async function openCheck(page: Page) {
  await page.goto('/learn');
  await page.getByRole('link', { name: 'Start the first lesson' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Parts of the guitar' })).toBeVisible();
  await page.getByRole('link', { name: 'Next: Listen' }).click();
  await page.getByRole('link', { name: 'Next: Practice' }).click();
  await page.getByRole('link', { name: 'Next: Check' }).click();
  await expect(page.getByText(/70% passes with one star/)).toBeVisible();
}

test('passing a lesson check earns stars and unlocks the next lesson', async ({ page }) => {
  await calibrate(page);
  await openCheck(page);

  // Arm the guitarist before playing, so it counts the one-bar count-in from its first click.
  await follow(
    page,
    4,
    Array.from({ length: FIRST_LESSON_NOTES }, () => ({ midi: LOW_E })),
  );
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  const result = page.getByRole('status').filter({ hasText: 'accuracy' });
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText('Passed! “Sitting with the guitar” is unlocked.');
  await expect(result.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(result.getByText('100%')).toBeVisible();

  await expect
    .poll(() => storedProgress(page))
    .toEqual({
      lessons: [
        expect.objectContaining({ lessonId: 'parts-of-the-guitar', stars: 3, attempts: 1 }),
      ],
      checks: [expect.objectContaining({ lessonId: 'parts-of-the-guitar', mode: 'check' })],
    });

  await result.getByRole('link', { name: 'Next lesson' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sitting with the guitar' }),
  ).toBeVisible();

  // The progress survives a reload.
  await page.goto('/learn/stage/first-steps');
  await expect(page.getByRole('link', { name: /Parts of the guitar.*completed/ })).toBeVisible();
  await expect(page.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Sitting with the guitar.*up next/ })).toBeVisible();
  await page.goto('/learn');
  await expect(page.getByRole('link', { name: 'Continue' })).toHaveAttribute(
    'href',
    '/learn/lesson/sitting-with-the-guitar/learn',
  );
});

test('a failed check keeps the next lesson locked', async ({ page }) => {
  await openCheck(page);
  // Only the first five notes: 5 of 16 is well under the 70 % pass mark.
  await follow(
    page,
    4,
    Array.from({ length: 5 }, () => ({ midi: LOW_E })),
  );
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  const result = page.getByRole('status').filter({ hasText: 'accuracy' });
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText('Not yet: 70% passes.');
  await expect(result.getByRole('img', { name: '0 of 3 stars' })).toBeVisible();
  await expect(result.getByRole('link', { name: 'Practise more' })).toBeVisible();

  await page.goto('/learn/lesson/sitting-with-the-guitar/learn');
  await expect(page.getByText('This lesson is locked')).toBeVisible();
  const { lessons } = await storedProgress(page);
  expect(lessons).toEqual([
    expect.objectContaining({ lessonId: 'parts-of-the-guitar', stars: 0, attempts: 1 }),
  ]);
});
