import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SCREENS = [
  '/welcome',
  '/tuner',
  '/learn',
  '/learn/stage/first-steps',
  '/learn/lesson/parts-of-the-guitar/learn',
  '/learn/lesson/parts-of-the-guitar/listen',
  '/learn/lesson/parts-of-the-guitar/check',
  '/learn/lesson/finger-numbers/learn',
  '/learn/stage/first-steps/test',
  '/learn/stage/lead-guitar-1',
  '/practice',
  '/practice/am-e-waltz',
  '/practice/open-strings',
  '/songs',
  '/songs/auld-lang-syne',
  '/profile',
  '/profile/chords',
  '/profile/chords/Em',
  '/profile/settings',
  '/nope',
];

for (const theme of ['dark', 'light'] as const) {
  test(`every screen passes axe WCAG 2.1 AA checks in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/profile/settings');
    await page.getByText('System', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    for (const path of SCREENS) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations, `axe violations on ${path}`).toEqual([]);
    }
  });
}

test('setup works with the keyboard alone and moves focus to each step', async ({ page }) => {
  await page.goto('/welcome');
  const firstChoice = page.getByRole('radio', { name: /I’ve never played/ });
  for (
    let i = 0;
    i < 10 && !(await firstChoice.evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press('Tab');
  }
  await expect(firstChoice).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /I know a few chords/ })).toBeChecked();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'FretPath listens while you play' }),
  ).toBeFocused();
});

test('keeps progress indicators visible in forced-colours mode', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/welcome');
  const done = page.locator('ol[aria-hidden] li').first();
  await expect(done).toHaveCSS('background-color', /rgb/);
  const color = await done.evaluate((el) => getComputedStyle(el).backgroundColor);
  const canvas = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(color).not.toBe(canvas);
});
