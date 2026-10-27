import { expect, test } from '@playwright/test';

test('remembers the chosen theme across reloads', async ({ page }) => {
  await page.goto('/profile/settings');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByText('Light', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  // Wait for the write to IndexedDB before reloading.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<unknown>((resolve, reject) => {
            const open = indexedDB.open('fretpath');
            open.onerror = () => {
              reject(new Error('open failed'));
            };
            open.onsuccess = () => {
              const request = open.result.transaction('kv').objectStore('kv').get('settings');
              request.onsuccess = () => {
                open.result.close();
                resolve(request.result);
              };
            };
          }),
      ),
    )
    .toMatchObject({ state: { theme: 'light' } });

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F6F7FB');
  await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked();
});

test('follows the operating system in "System" mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/profile/settings');

  await page.getByText('System', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('keeps working, with a warning, when storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined });
  });
  await page.goto('/profile/settings');

  await expect(page.getByRole('alert')).toContainText('Progress can’t be saved right now');
  await page.getByText('Light', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
