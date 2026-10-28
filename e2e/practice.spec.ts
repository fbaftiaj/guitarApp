import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { installAudioSpy, type StartedSound } from './support/audioSpy';

/**
 * The practicer end to end, on the real AudioContext. An audio spy records
 * each sound's requested start time on the audio clock, so timing is checked
 * exactly (to the microsecond) rather than with wall-clock waits.
 */

// No "ready to work offline" toast over the controls.
test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installAudioSpy);
});

const CLICK_HZ = { accent: 1760, normal: 1320 };

async function openExercise(page: Page, id: string) {
  await page.goto(`/practice/${id}`);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
}

async function started(page: Page): Promise<StartedSound[]> {
  return page.evaluate(() => window.audioSpy.started);
}

/** Metronome clicks (count-in included), in start order. */
async function clicks(page: Page): Promise<StartedSound[]> {
  return (await started(page)).filter((s) => s.kind === 'oscillator' && s.frequency >= 1000);
}

async function waitForClicks(page: Page, count: number) {
  await expect
    .poll(async () => (await clicks(page)).length, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(count);
}

const track = (page: Page) => page.getByTestId('highway-track');
const transformOf = (page: Page) => track(page).evaluate((element) => element.style.transform);
const tempoSlider = (page: Page) => page.getByRole('slider', { name: 'Tempo' });

function expectSpacing(sounds: readonly StartedSound[], seconds: number) {
  for (let i = 1; i < sounds.length; i++) {
    const gap = (sounds[i]?.when ?? 0) - (sounds[i - 1]?.when ?? 0);
    expect(Math.abs(gap - seconds), `gap ${i}: ${gap}`).toBeLessThan(1e-6);
  }
}

test('lists exercises and opens one at 60% of its target tempo with speed-up on', async ({
  page,
}) => {
  await page.goto('/practice');
  await page.getByRole('link', { name: /Em – Am changes/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Em – Am changes' })).toBeVisible();
  await expect(tempoSlider(page)).toHaveValue('48');
  await expect(page.getByText('target 80')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Auto speed-up' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Wait mode' })).not.toBeChecked();
  await expect(page.getByRole('img', { name: /^E minor chord/ })).toBeVisible();
  await expect(page.getByText('Bar 1 / 8')).toBeVisible();
});

test('counts in one bar, then clicks exactly on the beat, scheduled ahead', async ({ page }) => {
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: '100%' }).click(); // 80 BPM
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  await expect(page.getByText('Count-in', { exact: true })).toBeAttached();
  await waitForClicks(page, 10);
  const all = await clicks(page);

  expect(all.slice(0, 10).map((c) => c.frequency)).toEqual([
    ...[CLICK_HZ.accent, CLICK_HZ.normal, CLICK_HZ.normal, CLICK_HZ.normal], // count-in
    ...[CLICK_HZ.accent, CLICK_HZ.normal, CLICK_HZ.normal, CLICK_HZ.normal], // bar 1
    ...[CLICK_HZ.accent, CLICK_HZ.normal], // bar 2
  ]);
  expectSpacing(all, 0.75);
  for (const click of all) {
    expect(click.when).toBeGreaterThanOrEqual(click.calledAt);
    expect(click.when - click.calledAt).toBeLessThan(0.25);
  }
  await expect(page.getByText('Bar 2 / 8')).toBeVisible();
  await expect(page.getByText('Playing', { exact: true })).toBeAttached();
});

test('pause freezes the timeline; resume counts in and carries on from there', async ({ page }) => {
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: '125%' }).click(); // 100 BPM
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await waitForClicks(page, 6);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await expect(page.getByText(/^Paused at bar 1$/)).toBeAttached();
  await page.waitForTimeout(300); // the display catches up with the audio latency
  const frozen = await transformOf(page);
  const clicksAtPause = (await clicks(page)).length;
  await page.waitForTimeout(1000);
  expect(await transformOf(page)).toBe(frozen);
  expect((await clicks(page)).length).toBe(clicksAtPause);
  expect(frozen).not.toBe('translate3d(56px, 0px, 0px)');

  await page.getByRole('button', { name: 'Resume' }).click();
  await waitForClicks(page, clicksAtPause + 2);
  // Held still through the count-in…
  expect(await transformOf(page)).toBe(frozen);
  await waitForClicks(page, clicksAtPause + 4);
  const countIn = (await clicks(page)).slice(clicksAtPause, clicksAtPause + 4);
  expectSpacing(countIn, 0.6);
  // …then moving on from the paused position, not from the start.
  await waitForClicks(page, clicksAtPause + 6);
  await expect.poll(() => transformOf(page)).not.toBe(frozen);
  const position = (transform: string) => Number(/translate3d\((-?[\d.]+)px/.exec(transform)?.[1]);
  expect(position(await transformOf(page))).toBeLessThan(position(frozen));
});

test('restart goes back to bar 1 with a new count-in', async ({ page }) => {
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: '125%' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await waitForClicks(page, 9);
  await expect(page.getByText('Bar 2 / 8')).toBeVisible();

  const before = (await clicks(page)).length;
  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(page.getByText('Bar 1 / 8')).toBeVisible();
  await expect(page.getByText('Count-in', { exact: true })).toBeAttached();
  await waitForClicks(page, before + 1);
  const [first] = (await clicks(page)).slice(before);
  expect(first?.frequency).toBe(CLICK_HZ.accent);
});

test('loops the chosen bars and speeds up after each pass up to the target', async ({ page }) => {
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: '75%' }).click(); // 60 BPM
  await page.getByRole('switch', { name: 'Loop' }).click();
  await page.getByRole('combobox', { name: 'Loop to bar' }).selectOption('1');
  await page.getByText('+10', { exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  // Count-in (4 s) and one 4-beat pass at 60 BPM, then 70, then the 80 BPM target.
  await expect(tempoSlider(page)).toHaveValue('70', { timeout: 15_000 });
  await expect(page.getByText('Loop 2: tempo up to 70 BPM')).toBeAttached();
  await expect(page.getByText(/Loop 2 ·/)).toBeVisible();
  await expect(page.getByText('Bar 1 / 8')).toBeVisible();
  await expect(tempoSlider(page)).toHaveValue('80', { timeout: 10_000 });
  await expect(page.getByText('Loop 3: tempo up to 80 BPM')).toBeAttached();

  // Every beat click falls on bar 1: an accent every four clicks.
  const beats = (await clicks(page)).slice(4);
  beats.forEach((click, i) => {
    expect(click.frequency).toBe(i % 4 === 0 ? CLICK_HZ.accent : CLICK_HZ.normal);
  });
  await page.getByRole('button', { name: 'Pause' }).click();
});

test('wait mode stops on each chord until Next', async ({ page }) => {
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: '125%' }).click(); // 100 BPM
  await page.getByRole('switch', { name: 'Wait mode' }).click();
  await expect(page.getByRole('switch', { name: 'Auto speed-up' })).not.toBeChecked();
  const next = page.getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(next).toBeEnabled();
  await expect(page.getByText('Waiting for E minor. Play it, then tap Next.')).toBeAttached();
  await page.waitForTimeout(500);
  expect(await clicks(page)).toEqual([]); // no count-in, nothing moves

  await next.click();
  await expect(page.getByText('Waiting for A minor. Play it, then tap Next.')).toBeAttached({
    timeout: 5000,
  });
  await expect(page.getByText('Bar 2 / 8')).toBeVisible();
  await expect(page.getByText('Am', { exact: true }).first()).toBeVisible();
  // Beats 2–4 of bar 1 clicked; beat 1 was the chord the player played.
  const bar1 = await clicks(page);
  expect(bar1.map((c) => c.frequency)).toEqual([CLICK_HZ.normal, CLICK_HZ.normal, CLICK_HZ.normal]);
  expectSpacing(bar1, 0.6);
});

test('mutes the metronome but keeps the count-in; the guide strums the chords', async ({
  page,
}) => {
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: '125%' }).click();
  await page.getByRole('switch', { name: 'Metronome' }).click();
  await page.getByRole('switch', { name: 'Backing track' }).click();
  await page.getByRole('switch', { name: 'Guide playback' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  await expect(page.getByText('Bar 2 / 8')).toBeVisible({ timeout: 10_000 });
  expect((await clicks(page)).length).toBe(4);
  const plucks = (await started(page)).filter((s) => s.kind === 'buffer');
  // Down-strums of E minor: all six strings, 12 ms apart, low to high.
  expect(plucks.length).toBeGreaterThanOrEqual(24);
  const firstStrum = plucks.slice(0, 6).map((p) => p.when - (plucks[0]?.when ?? 0));
  firstStrum.forEach((offset, i) => {
    expect(offset).toBeCloseTo(i * 0.012, 6);
  });
  await page.getByRole('button', { name: 'Pause' }).click();
});

test('label and fretboard toggles change what is shown', async ({ page }) => {
  await openExercise(page, 'em-am-changes');
  const nowChord = page.getByText('Em', { exact: true }).first();
  await expect(nowChord).toBeVisible();
  await expect(page.getByRole('img', { name: /^E minor chord:.*finger 2/ })).toBeVisible();

  await page.getByRole('switch', { name: 'Chord names' }).click();
  await expect(page.getByText('Em', { exact: true })).toHaveCount(0);

  await page.getByRole('switch', { name: 'Finger numbers' }).click();
  await expect(page.getByRole('img', { name: /^E minor chord:/ })).not.toHaveAccessibleName(
    /finger/,
  );

  await page.getByRole('switch', { name: 'Fretboard view' }).click();
  await expect(page.getByRole('img', { name: 'E minor on the fretboard' })).toBeVisible();
});

test('shows a tab lane with notes on their strings for single-note exercises', async ({ page }) => {
  await openExercise(page, 'e-minor-riff');
  await expect(page.getByText('String 6 (low E), open').first()).toBeVisible();
  await page.getByRole('switch', { name: 'Note names' }).click();
  await expect(page.getByText('String 6 (low E), open · E').first()).toBeVisible();
  await expect(track(page).getByText('3G')).toHaveCount(4);
});

test('remembers tempo, loop and mix per exercise', async ({ page }) => {
  await openExercise(page, 'g-c-d-folk');
  await page.getByRole('button', { name: 'Faster by 1 BPM' }).click();
  await page.getByRole('switch', { name: 'Loop' }).click();
  // 80 % → 40 % in 5 % steps.
  const volume = page.getByRole('slider', { name: 'Metronome volume' });
  await volume.focus();
  for (let i = 0; i < 8; i++) await volume.press('ArrowLeft');
  await expect(tempoSlider(page)).toHaveValue('55');

  await page.reload();
  await expect(tempoSlider(page)).toHaveValue('55');
  await expect(page.getByRole('combobox', { name: 'Loop from bar' })).toHaveValue('1');
  await expect(page.getByRole('combobox', { name: 'Loop to bar' })).toHaveValue('2');
  await expect(page.getByRole('slider', { name: 'Metronome volume' })).toHaveValue('40');

  // Another exercise keeps its own tempo and loop; the mix is shared.
  await openExercise(page, 'em-am-changes');
  await expect(tempoSlider(page)).toHaveValue('48');
  await expect(page.getByRole('switch', { name: 'Loop' })).not.toBeChecked();
  await expect(page.getByRole('slider', { name: 'Metronome volume' })).toHaveValue('40');
});

test('pauses when the app goes to the background', async ({ page }) => {
  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await waitForClicks(page, 2);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
});

test('shows a message for an unknown exercise', async ({ page }) => {
  await page.goto('/practice/not-an-exercise');
  await expect(page.getByRole('heading', { name: 'No such exercise' })).toBeVisible();
  await page.getByRole('link', { name: 'All exercises' }).last().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Practice' })).toBeVisible();
});

test('scrolls smoothly and keeps the beat on a slowed-down CPU', async ({ page }) => {
  await openExercise(page, 'g-c-d-folk');
  await page.getByRole('switch', { name: 'Guide playback' }).click();
  await page.getByRole('button', { name: '100%' }).click(); // 90 BPM
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await waitForClicks(page, 5);
  const cdp = await page.context().newCDPSession(page);
  // Roughly a mid-range phone compared with a desktop CPU.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const { fps, moves } = await page.evaluate(
    () =>
      new Promise<{ fps: number; moves: number }>((resolve) => {
        const element = document.querySelector<HTMLElement>('[data-testid="highway-track"]');
        let frames = 0;
        let moves = 0;
        let last = '';
        let start = 0;
        requestAnimationFrame(function tick(now) {
          if (start === 0) start = now;
          frames++;
          const transform = element?.style.transform ?? '';
          if (transform !== last) moves++;
          last = transform;
          if (now - start < 2000) requestAnimationFrame(tick);
          else resolve({ fps: ((frames - 1) * 1000) / (now - start), moves: moves / frames });
        });
      }),
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  expect(fps).toBeGreaterThanOrEqual(30);
  expect(moves).toBeGreaterThan(0.9); // the highway moves on (nearly) every frame
  const all = await clicks(page);
  expectSpacing(all, 60 / 90);
  for (const click of all) expect(click.when).toBeGreaterThanOrEqual(click.calledAt);
});

test('passes axe checks while playing, waiting and with every view on', async ({ page }) => {
  const scan = async () =>
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations;

  await openExercise(page, 'em-am-changes');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByText('Count-in', { exact: true })).toBeAttached();
  expect(await scan()).toEqual([]);
  await page.getByRole('button', { name: 'Pause' }).click();

  await page.getByRole('switch', { name: 'Wait mode' }).click();
  await page.getByRole('switch', { name: 'Loop' }).click();
  await page.getByRole('switch', { name: 'Fretboard view' }).click();
  await page.getByRole('switch', { name: 'Note names' }).click();
  await page.getByRole('button', { name: 'Restart' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
  expect(await scan()).toEqual([]);

  await openExercise(page, 'e-minor-riff');
  expect(await scan()).toEqual([]);
});
