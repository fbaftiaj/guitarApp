import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installFakeMicrophone, installReferenceToneCounter } from './support/fakeMicrophone';

/**
 * The tuner end to end: a fake microphone feeds a known tone (a band-limited
 * sawtooth) into the real pipeline — shared AudioContext, pitch AudioWorklet,
 * stabilizer, tuner engine and UI.
 */

// No "ready to work offline" toast over the pegs.
test.use({ serviceWorkers: 'block' });

const HZ = { E2: 82.4069, A2: 110, D3: 146.8324, G3: 195.9977, B3: 246.9417, E4: 329.6276 };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeMicrophone);
  await page.addInitScript(installReferenceToneCounter);
});

async function play(page: Page, hz: number) {
  await page.evaluate((frequency) => {
    window.fakeMicrophone.setFrequency(frequency);
  }, hz);
}

async function startTuner(page: Page, hz: number = HZ.A2) {
  await page.goto('/tuner');
  await play(page, hz);
  await page.getByRole('button', { name: 'Tap to tune' }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
}

const micIsLive = (page: Page) => page.evaluate(() => window.fakeMicrophone.isLive());
const meter = (page: Page) => page.getByRole('meter', { name: 'Tuning offset' });
const peg = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Strings' }).getByRole('button', { name });

test('asks for the microphone only on tap, with voice processing off', async ({ page }) => {
  await page.goto('/tuner');
  await expect(page.getByText('The sound stays on your device.')).toBeVisible();
  expect(await page.evaluate(() => window.fakeMicrophone.calls())).toBe(0);

  await page.getByRole('button', { name: 'Tap to tune' }).click();

  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  const constraints = await page.evaluate(() => window.fakeMicrophone.lastConstraints());
  expect(constraints?.audio).toMatchObject({
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });
});

test('finds the string in auto mode and says which way to tune', async ({ page }) => {
  await startTuner(page, 107);

  await expect(meter(page)).toHaveAttribute('aria-valuetext', /^4[89] cents flat$/);
  await expect(page.getByText('Tune up')).toBeVisible();

  await play(page, 113);
  await expect(meter(page)).toHaveAttribute('aria-valuetext', /^4[67] cents sharp$/);
  await expect(page.getByText('Tune down')).toBeVisible();

  await play(page, HZ.A2);
  await expect(meter(page)).toHaveAttribute('aria-valuetext', 'In tune');
  await expect(page.getByText('In tune', { exact: true })).toBeVisible();
});

test('ticks each string off and celebrates a tuned guitar', async ({ page }) => {
  await startTuner(page, HZ.E2);

  const strings: [RegExp, number][] = [
    [/^E2, 6th string/, HZ.E2],
    [/^A2, 5th string/, HZ.A2],
    [/^D3, 4th string/, HZ.D3],
    [/^G3, 3rd string/, HZ.G3],
    [/^B3, 2nd string/, HZ.B3],
    [/^E4, 1st string/, HZ.E4],
  ];
  for (const [name, hz] of strings) {
    await play(page, hz);
    await expect(peg(page, name)).toHaveAccessibleName(/, in tune$/, { timeout: 5000 });
  }

  const banner = page.getByText('Guitar tuned!', { exact: true });
  await expect(banner).toBeVisible();
  await page.getByRole('button', { name: 'Tune again' }).click();
  await expect(banner).toBeHidden();
});

test('measures against the chosen string in manual mode and plays its note', async ({ page }) => {
  await startTuner(page, HZ.A2);
  await page.getByText('Manual', { exact: true }).click();

  const d3 = peg(page, /^D3, 4th string/);
  await d3.click();

  await expect(d3).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.referenceTonesStarted)).toBe(1);
  await expect(meter(page)).toHaveAttribute('aria-valuetext', '500 cents flat');
  await expect(page.getByText('−500 ¢')).toBeVisible();
});

test('names any note in chromatic mode, against the chosen A4', async ({ page }) => {
  await startTuner(page, 440);
  await page.getByRole('button', { name: 'Tuner settings' }).click();
  const raise = page.getByRole('button', { name: 'Raise the reference pitch by 1 Hz' });
  await raise.click();
  await raise.click();
  await expect(page.getByRole('dialog').getByText('442 Hz')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByText('Chromatic', { exact: true }).click();

  await expect(page.getByText('A4 = 442 Hz')).toBeVisible();
  await expect(meter(page)).toHaveAttribute('aria-valuetext', '8 cents flat');
  await expect(page.getByText('−8 ¢')).toBeVisible();
});

test('remembers the instrument and tuning', async ({ page }) => {
  await page.goto('/tuner');
  await page.getByRole('button', { name: /Change instrument or tuning/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Instrument and tuning' });
  await sheet.getByText('Bass · 4-string').click();
  await sheet.getByText('Drop D', { exact: true }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();

  const picker = page.getByRole('button', { name: /Change instrument or tuning/ });
  await expect(picker).toContainText('Bass · 4-string · Drop D');

  await page.reload();
  await expect(picker).toContainText('Bass · 4-string · Drop D');
  await expect(page.getByRole('group', { name: 'Strings' }).getByRole('button')).toHaveCount(4);
  await expect(peg(page, /^D1, 4th string/)).toBeVisible();
});

test('releases the microphone on stop and when leaving the tuner', async ({ page }) => {
  await startTuner(page);
  expect(await micIsLive(page)).toBe(true);

  await page.getByRole('button', { name: 'Stop' }).click();
  await expect.poll(() => micIsLive(page)).toBe(false);
  await expect(page.getByRole('button', { name: 'Tap to tune' })).toBeVisible();

  await page.getByRole('button', { name: 'Tap to tune' }).click();
  await expect.poll(() => micIsLive(page)).toBe(true);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Learn' }).click();
  await expect.poll(() => micIsLive(page)).toBe(false);
});

test('pauses in the background and resumes on return', async ({ page }) => {
  await startTuner(page);
  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { value, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);

  await setVisibility('hidden');
  await expect.poll(() => micIsLive(page)).toBe(false);

  await setVisibility('visible');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect.poll(() => micIsLive(page)).toBe(true);
  await expect(meter(page)).toHaveAttribute('aria-valuetext', 'In tune');
});

for (const [name, title] of [
  ['NotAllowedError', 'Microphone access is blocked'],
  ['NotFoundError', 'No microphone found'],
  ['NotReadableError', 'The microphone is busy'],
] as const) {
  test(`explains a ${name} and recovers on retry`, async ({ page }) => {
    await page.goto('/tuner');
    await page.evaluate((errorName) => {
      window.fakeMicrophone.failNextWith(errorName);
    }, name);

    await page.getByRole('button', { name: 'Tap to tune' }).click();
    await expect(page.getByRole('alert')).toContainText(title);

    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  });
}

test('explains that the microphone needs a secure page', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'isSecureContext', { value: false });
  });
  await page.goto('/tuner');
  await page.getByRole('button', { name: 'Tap to tune' }).click();

  await expect(page.getByRole('alert')).toContainText('The tuner needs a secure connection');
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
});

test('keeps the needle animating at 30+ fps on a slowed-down CPU', async ({ page }) => {
  await startTuner(page, 107);
  const cdp = await page.context().newCDPSession(page);
  // Roughly a mid-range phone compared with a desktop CPU.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const fps = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        let start = 0;
        requestAnimationFrame(function tick(now) {
          if (start === 0) start = now;
          frames++;
          if (now - start < 2000) requestAnimationFrame(tick);
          else resolve(((frames - 1) * 1000) / (now - start));
        });
      }),
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  expect(fps).toBeGreaterThanOrEqual(30);
});

test('passes axe checks while listening and with the pickers open', async ({ page }) => {
  await startTuner(page, 107);
  const scan = () =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

  expect((await scan()).violations).toEqual([]);

  await page.getByRole('button', { name: /Change instrument or tuning/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await scan()).violations).toEqual([]);
});
