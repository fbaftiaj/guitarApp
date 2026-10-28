import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Opens the practicer's Options sheet (listening, loop, sound, display), runs
 * `change` on it and closes it again, back to the play-along view.
 */
export async function withOptions(page: Page, change: (options: Locator) => Promise<void>) {
  const options = page.getByRole('dialog', { name: 'Options' });
  await page.getByRole('button', { name: /^Options:/ }).click();
  await expect(options).toBeVisible();
  await change(options);
  await options.getByRole('button', { name: 'Close' }).click();
  await expect(options).toBeHidden();
}
