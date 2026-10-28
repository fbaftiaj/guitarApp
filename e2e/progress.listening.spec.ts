import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { installFakeGuitarist, type GuitarPart } from './support/fakeGuitarist';
import { EM, calibrate, follow } from './support/listening';

/**
 * Stage tests, the profile and the chord library's microphone check, with
 * the fake guitarist playing into the real analysis worklet. Runs in the
 * "listening" project, one test at a time (playwright.config.ts).
 */

test.use({ serviceWorkers: 'block' });
// The Stage 1 test plays three parts in real time (about 45 s), plus calibration.
test.describe.configure({ timeout: 150_000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeGuitarist);
});

const E_MAJOR = [40, 47, 52, 56, 59, 64];

const notes = (...midis: (number | null)[]): GuitarPart[] =>
  midis.map((midi) => (midi === null ? null : { midi }));

/** What each part of the Stage 1 test plays, one entry per click (null: a note held on). */
const STAGE_1_TEST = [
  // Open strings: 6 5 4 3 | 2 1 2 3 | 4 5 6, the last held for two beats.
  notes(40, 45, 50, 55, 59, 64, 59, 55, 50, 45, 40, null),
  // Frets on the top two strings, ending on the open high e, held.
  notes(64, 65, 67, 65, 60, 61, 62, 63, 62, 60, 64, null),
  // A short melody with half and whole notes.
  notes(64, 62, 60, null, 62, 64, 65, null, 67, 65, 64, 62, 60, null, null, null),
];

const STAGE_1_LESSONS = (
  JSON.parse(readFileSync('src/content/course/stage-1.json', 'utf8')) as {
    units: { lessons: { id: string }[] }[];
  }
).units.flatMap((unit) => unit.lessons.map((lesson) => lesson.id));

/** Stores the lessons as passed with two stars, as if played. */
async function passLessons(page: Page, lessonIds: readonly string[]) {
  await page.evaluate(async (ids) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fretpath');
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(new Error('could not open the database'));
      };
    });
    const tx = db.transaction('lessonProgress', 'readwrite');
    for (const lessonId of ids) {
      tx.objectStore('lessonProgress').put({
        lessonId,
        stars: 2,
        bestAccuracy: 0.9,
        attempts: 1,
        completedAt: 1,
        updatedAt: 1,
      });
    }
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
    db.close();
  }, lessonIds);
}

/** Seconds of practice saved for today (written asynchronously). */
function practiceSecondsToday(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const request = indexedDB.open('fretpath');
        request.onsuccess = () => {
          const read = request.result.transaction('kv').objectStore('kv').get('activity');
          read.onsuccess = () => {
            const value = read.result as { state?: { days?: Record<string, number> } } | undefined;
            const now = new Date();
            const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            resolve(value?.state?.days?.[day] ?? 0);
          };
        };
      }),
  );
}

test('passing the Stage 1 test opens Stage 2 and raises the level', async ({ page }) => {
  await calibrate(page);
  await passLessons(page, STAGE_1_LESSONS);

  await page.goto('/learn');
  await expect(page.getByRole('link', { name: 'Take the test' })).toBeVisible();
  await page.getByRole('link', { name: 'Take the test' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Stage 1 test' })).toBeVisible();
  await page.getByRole('button', { name: 'Start the test' }).click();

  for (const [i, parts] of STAGE_1_TEST.entries()) {
    await expect(
      page.getByRole('heading', { name: new RegExp(`^Part ${i + 1} of 3`) }),
    ).toBeVisible();
    // Arm the guitarist before playing, so it counts the one-bar count-in from its first click.
    await follow(page, 4, parts);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const partResult = page.getByRole('status').filter({ hasText: 'accuracy on this part' });
    await expect(partResult).toBeVisible({ timeout: 30_000 });
    await expect(partResult).toContainText('100%');
    await partResult
      .getByRole('button', { name: i < STAGE_1_TEST.length - 1 ? 'Next part' : 'See your result' })
      .click();
  }

  const result = page.getByRole('status').filter({ hasText: 'accuracy over 3 parts' });
  await expect(result).toContainText('Stage 1 passed! You’re now Beginner 2.');
  await expect(result.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await result.getByRole('link', { name: 'E minor (Em)' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'E minor (Em)' })).toBeVisible();

  // The profile reflects the results, after a reload.
  await expect.poll(() => practiceSecondsToday(page)).toBeGreaterThan(30);
  await page.goto('/profile');
  await expect(page.getByText('Beginner 2', { exact: true })).toBeVisible();
  await expect(page.getByText('1 stage test')).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Single notes' })).toHaveAttribute(
    'aria-valuetext',
    '100%, from 3 sessions',
  );
  await expect(page.getByRole('meter', { name: 'Chords' })).toHaveAttribute(
    'aria-valuetext',
    'Not practised yet',
  );
  await expect(
    page
      .getByRole('group', { name: /Accuracy per day/ })
      .getByRole('img', { name: /100%, 3 sessions/ }),
  ).toBeVisible();

  await page.goto('/learn');
  await expect(page.getByRole('link', { name: /Stage 1: First Steps/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue' })).toHaveAttribute(
    'href',
    '/learn/lesson/e-minor-chord/learn',
  );
});

test('a failed stage test keeps the next stage closed', async ({ page }) => {
  await page.goto('/learn');
  await passLessons(page, STAGE_1_LESSONS);
  await page.goto('/learn/stage/first-steps/test');
  await page.getByRole('button', { name: 'Start the test' }).click();
  for (const [i] of STAGE_1_TEST.entries()) {
    // Nothing is played at all.
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const partResult = page.getByRole('status').filter({ hasText: 'accuracy on this part' });
    await expect(partResult).toContainText('0%', { timeout: 30_000 });
    await partResult
      .getByRole('button', { name: i < STAGE_1_TEST.length - 1 ? 'Next part' : 'See your result' })
      .click();
  }
  await expect(page.getByRole('status').filter({ hasText: 'accuracy over 3 parts' })).toContainText(
    'Not yet: 70% passes.',
  );
  await page.goto('/learn/stage/open-chords-1');
  await expect(page.getByText('Pass the Stage 1 test to unlock this stage.')).toBeVisible();
});

test('the chord library checks a chord with the microphone', async ({ page }) => {
  await page.goto('/learn');
  await passLessons(page, ['e-minor-chord']);
  await page.goto('/profile/chords');
  await page.getByRole('link', { name: /E minor/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'E minor' })).toBeVisible();

  await page.getByRole('button', { name: 'Check it with the microphone' }).click();
  const status = page.getByRole('status');
  await expect(status).toHaveText('Strum E minor once and let it ring.');
  await expect.poll(() => page.evaluate(() => window.fakeGuitarist.isLive())).toBe(true);

  await page.evaluate((midis) => {
    window.fakeGuitarist.playNow({ midis });
  }, EM);
  await expect(status).toHaveText('That’s E minor!');

  await page.evaluate((midis) => {
    window.fakeGuitarist.playNow({ midis });
  }, E_MAJOR);
  await expect(status).toHaveText('That sounded like E major. Check each finger and try again.');

  await page.getByRole('button', { name: 'Stop listening' }).click();
  await expect.poll(() => page.evaluate(() => window.fakeGuitarist.isLive())).toBe(false);
});
