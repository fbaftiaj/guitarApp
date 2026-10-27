import { expect, test } from '@playwright/test';
import { installFakeMicrophone } from './support/fakeMicrophone';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface WebManifest {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  orientation: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
}

test('serves an installable web app manifest', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const response = await request.get(href ?? '');
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as WebManifest;

  expect(manifest).toMatchObject({
    name: 'FretPath — Learn Guitar',
    short_name: 'FretPath',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#0B0E14',
    background_color: '#0B0E14',
  });
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);

  for (const icon of manifest.icons) {
    const iconResponse = await request.get(`/${icon.src}`);
    expect(iconResponse.ok(), icon.src).toBe(true);
    expect(iconResponse.headers()['content-type']).toBe('image/png');
  }
});

test('meets Chrome’s installability criteria', async ({ page }) => {
  await page.goto('/tuner');
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');

  expect(installabilityErrors).toEqual([]);
});

test('works offline once the service worker is installed', async ({ page, context }) => {
  await page.goto('/tuner');
  await expect(page.getByRole('status')).toContainText('ready to work offline');
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);

  // A full page load and a code-split screen, both served from the precache.
  await page.goto('/learn');
  await expect(page.getByRole('heading', { level: 1, name: 'Learn' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Songs' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Songs' })).toBeVisible();
});

test.describe('offline tuner', () => {
  test('tunes offline, with the pitch worklet served from the precache', async ({
    page,
    context,
  }) => {
    await page.addInitScript(installFakeMicrophone);
    await page.goto('/tuner');
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);

    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: 'Tap to tune' }).click();

    await expect(page.getByRole('meter', { name: 'Tuning offset' })).toHaveAttribute(
      'aria-valuetext',
      'In tune',
    );
  });
});
