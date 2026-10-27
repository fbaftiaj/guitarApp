import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const SCREENS = [
  '/tuner',
  '/learn',
  '/practice',
  '/songs',
  '/profile',
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
