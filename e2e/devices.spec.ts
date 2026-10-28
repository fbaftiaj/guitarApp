import { devices, expect, test, type Page } from '@playwright/test';

/**
 * Layout across device sizes, emulated in Chromium: viewport, pixel ratio,
 * touch and user agent of each device (the only browser installed here, so
 * WebKit-specific behaviour still needs real devices). Runs in the "devices"
 * project (playwright.config.ts).
 */

test.use({ serviceWorkers: 'block' });

/** A device's viewport, pixel ratio, touch and user agent, run in Chromium whatever its browser. */
function emulate(name: string) {
  const device = devices[name];
  if (!device) throw new Error(`unknown device ${name}`);
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = device;
  return { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };
}

const DEVICES = [
  'iPhone SE',
  'Galaxy S8',
  'Pixel 7',
  'iPhone 15 Pro Max',
  'iPad Mini',
  'iPad Mini landscape',
] as const;

const SCREENS = [
  '/welcome',
  '/tuner',
  '/learn',
  '/learn/lesson/parts-of-the-guitar/learn',
  '/learn/lesson/parts-of-the-guitar/check',
  '/practice/g-c-d-folk',
  '/songs/auld-lang-syne',
  '/profile',
  '/profile/chords/Em',
];

async function checkLayout(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('main h1')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);

  // Every visible button is a comfortable touch target.
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('main button'))
      .filter((button) => {
        const box = button.getBoundingClientRect();
        return box.width > 0 && (box.width < 44 || box.height < 44);
      })
      .map((button) => button.getAttribute('aria-label') ?? button.textContent),
  );
  expect(small, `${path} has small buttons`).toEqual([]);
}

for (const name of DEVICES) {
  test.describe(name, () => {
    test.use(emulate(name));

    test('every screen fits without sideways scrolling, with full-size buttons', async ({
      page,
    }) => {
      for (const path of SCREENS) await checkLayout(page, path);
    });

    test('the practicer keeps its focused controls clear of the tab bar', async ({ page }) => {
      await page.goto('/practice/g-c-d-folk');
      const play = page.getByRole('button', { name: 'Play', exact: true });
      // Focus scrolls the control into view, as a keyboard or switch user would.
      await play.focus();
      const box = await play.boundingBox();
      const viewport = page.viewportSize();
      expect(box && viewport).toBeTruthy();
      if (!box || !viewport) return;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      // Above the tab bar on phones and small tablets.
      const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
      if (nav && nav.y > viewport.height / 2) expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
    });
  });
}
