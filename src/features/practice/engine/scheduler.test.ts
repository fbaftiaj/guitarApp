// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { MusicalEvent } from './arrangement';
import { LOOKAHEAD_SECONDS, LookaheadScheduler, type Timers } from './scheduler';
import { Transport, type ScheduledSound } from './transport';

/** A manual clock and interval timer: the test decides when each tick fires. */
function fakeTimers() {
  let callback: (() => void) | null = null;
  let interval = 0;
  const timers: Timers = {
    setInterval: vi.fn((fn: () => void, ms: number) => {
      callback = fn;
      interval = ms;
      return 1;
    }),
    clearInterval: vi.fn(() => {
      callback = null;
    }),
  };
  return {
    timers,
    get interval() {
      return interval;
    },
    fire() {
      callback?.();
    },
    get active() {
      return callback !== null;
    },
  };
}

describe('LookaheadScheduler', () => {
  it('fills the first window at once, then on every tick', () => {
    let now = 5;
    const onTick = vi.fn();
    const fake = fakeTimers();
    const scheduler = new LookaheadScheduler({ now: () => now, onTick, timers: fake.timers });

    scheduler.start();
    expect(onTick).toHaveBeenCalledWith(5 + LOOKAHEAD_SECONDS);
    expect(fake.interval).toBe(25);
    expect(scheduler.running).toBe(true);

    now = 5.03;
    fake.fire();
    expect(onTick).toHaveBeenLastCalledWith(5.03 + LOOKAHEAD_SECONDS);

    scheduler.start();
    expect(fake.timers.setInterval).toHaveBeenCalledTimes(1);
    scheduler.stop();
    expect(fake.active).toBe(false);
    expect(scheduler.running).toBe(false);
    scheduler.stop();
    expect(fake.timers.clearInterval).toHaveBeenCalledTimes(1);
  });

  describe('with the transport', () => {
    const events: MusicalEvent[] = Array.from({ length: 32 }, (_, i) => ({
      part: 'guide',
      kind: 'note',
      beat: i / 2,
      duration: 0.5,
      midi: 60,
    }));

    function setup(tempo: number) {
      let now = 0;
      const scheduled: { sound: ScheduledSound; at: number }[] = [];
      const transport = new Transport(
        { beatsPerBar: 4, totalBeats: 16, events, targets: [] },
        { tempo, loop: { start: 0, end: 16 }, waitMode: false, speedUp: null },
      );
      const fake = fakeTimers();
      const scheduler = new LookaheadScheduler({
        now: () => now,
        timers: fake.timers,
        onTick: (until) => {
          for (const sound of transport.advance(until).sounds) scheduled.push({ sound, at: now });
        },
      });
      return {
        transport,
        scheduler,
        scheduled,
        /** Advances the clock by `ms`, then fires a tick. */
        step: (ms: number) => {
          now += ms / 1000;
          fake.fire();
        },
      };
    }

    it('schedules every sound ahead of time despite jitter and stalls under the lookahead', () => {
      const { transport, scheduler, scheduled, step } = setup(180);
      transport.play(0);
      scheduler.start();
      const delays = [25, 25, 40, 12, 90, 25, 25, 60, 8, 75];
      for (let i = 0; i < 1200; i++) step(delays[i % delays.length] ?? 25);

      expect(scheduled.length).toBeGreaterThan(300);
      for (const { sound, at } of scheduled) expect(sound.time).toBeGreaterThanOrEqual(at);

      // Eighth notes stay exactly 1/6 s apart across ticks and loop wraps.
      const music = scheduled.filter(({ sound }) => sound.kind === 'music');
      music.forEach(({ sound }, i) => {
        expect(sound.time).toBeCloseTo(0.05 + 4 / 3 + i / 6, 9);
      });
      const times = scheduled.map(({ sound }) => `${sound.kind}@${sound.time.toFixed(9)}`);
      expect(new Set(times).size).toBe(times.length);
    });

    it('only falls behind when the main thread stalls longer than the lookahead', () => {
      const { transport, scheduler, scheduled, step } = setup(120);
      transport.play(0);
      scheduler.start();
      for (let i = 0; i < 100; i++) step(25);
      const before = scheduled.length;
      step(600);
      const late = scheduled.slice(before).filter(({ sound, at }) => sound.time < at);
      expect(late.length).toBeGreaterThan(0);
    });
  });
});
