import { expect, test } from '@playwright/test';

const TABS = ['Tuner', 'Learn', 'Practice', 'Songs', 'Profile'];

test('opens the tuner and reaches every tab', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/tuner$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tuner' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const name of TABS) {
    await nav.getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle(`${name} · FretPath`);
  }
});

test('never scrolls horizontally', async ({ page }) => {
  for (const path of ['/tuner', '/learn', '/practice', '/songs', '/profile', '/profile/settings']) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${path}`).toBe(0);
  }
});

test('shows a not-found screen for unknown links', async ({ page }) => {
  await page.goto('/definitely-not-a-page');

  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Go to the tuner' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tuner' })).toBeVisible();
});

test.describe('phone layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone only');

  test('docks the tab bar at the bottom with thumb-sized targets', async ({ page }) => {
    await page.goto('/tuner');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const viewport = page.viewportSize();
    const navBox = await nav.boundingBox();

    expect(viewport).not.toBeNull();
    expect(navBox).not.toBeNull();
    if (!viewport || !navBox) return;
    expect(Math.round(navBox.y + navBox.height)).toBe(viewport.height);
    expect(navBox.width).toBe(viewport.width);

    for (const link of await nav.getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('keeps content clear of the tab bar when scrolled to the end', async ({ page }) => {
    await page.goto('/profile');
    // The last thing on the profile.
    const action = page.getByRole('link', { name: /Chord library/ });
    await action.scrollIntoViewIfNeeded();

    const navTop = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())?.y ?? 0;
    const actionBottom = await action.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(actionBottom).toBeLessThanOrEqual(navTop);
  });
});

test.describe('desktop layout', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('uses a side rail and a centred content column', async ({ page }) => {
    await page.goto('/learn');
    const navBox = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    const headingBox = await page.locator('main h1').boundingBox();
    const viewport = page.viewportSize();

    expect(navBox && headingBox && viewport).toBeTruthy();
    if (!navBox || !headingBox || !viewport) return;
    // Rail: pinned left, full height.
    expect(navBox.x).toBe(0);
    expect(navBox.height).toBe(viewport.height);
    // Content column: right of the rail and not stretched to the viewport edge.
    expect(headingBox.x).toBeGreaterThan(navBox.width + 100);
    expect(headingBox.x + headingBox.width).toBeLessThan(viewport.width - 100);
  });
});
