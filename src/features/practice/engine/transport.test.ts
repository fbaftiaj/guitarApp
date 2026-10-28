// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { MusicalEvent } from './arrangement';
import {
  Transport,
  clampTempo,
  type ScheduledSound,
  type TransportConfig,
  type TransportNotice,
  type TransportSettings,
} from './transport';

const LOOKAHEAD = 0.1;
const START_DELAY = 0.05;

/** One guide note on every beat of a 4/4 exercise, `bars` long. */
function config(bars = 2, overrides: Partial<TransportConfig> = {}): TransportConfig {
  const totalBeats = bars * 4;
  const events: MusicalEvent[] = Array.from({ length: totalBeats }, (_, beat) => ({
    part: 'guide',
    kind: 'note',
    beat,
    duration: 1,
    midi: 60 + beat,
  }));
  return {
    beatsPerBar: 4,
    totalBeats,
    events,
    targets: Array.from({ length: bars }, (_, bar) => bar * 4),
    startDelay: START_DELAY,
    ...overrides,
  };
}

function settings(overrides: Partial<TransportSettings> = {}): TransportSettings {
  return { tempo: 120, loop: null, waitMode: false, speedUp: null, ...overrides };
}

interface Collected {
  sounds: ScheduledSound[];
  notices: TransportNotice[];
}

/**
 * Drives the transport like the lookahead scheduler: a tick every `stepMs`
 * from `fromMs` to `toMs`, each filling the window up to now + 100 ms. Checks
 * that no sound is ever scheduled after its start time has passed.
 */
function drive(transport: Transport, fromMs: number, toMs: number, stepMs = 25): Collected {
  const collected: Collected = { sounds: [], notices: [] };
  for (let ms = fromMs; ms <= toMs; ms += stepMs) {
    const now = ms / 1000;
    const { sounds, notices } = transport.advance(now + LOOKAHEAD);
    for (const sound of sounds) {
      expect(sound.time, `sound at ${sound.time} scheduled late at ${now}`).toBeGreaterThanOrEqual(
        now - 1e-9,
      );
      expect(sound.time).toBeLessThan(now + LOOKAHEAD + 1e-9);
    }
    collected.sounds.push(...sounds);
    collected.notices.push(...notices);
  }
  return collected;
}

function clicks(collected: Collected) {
  return collected.sounds.flatMap((s) => (s.kind === 'click' ? [s] : []));
}

function notes(collected: Collected) {
  return collected.sounds.flatMap((s) =>
    s.kind === 'music' && s.event.kind === 'note' ? [{ time: s.time, beat: s.event.beat }] : [],
  );
}

describe('Transport', () => {
  describe('count-in and timing', () => {
    it('counts in one bar, then plays on the beat grid', () => {
      const transport = new Transport(config(), settings());
      transport.play(0);
      const out = drive(transport, 0, 2500);

      const countIn = clicks(out).filter((c) => c.countIn);
      expect(countIn.map((c) => c.time)).toEqual([0.05, 0.55, 1.05, 1.55]);
      expect(countIn.map((c) => c.accent)).toEqual([true, false, false, false]);

      const beats = clicks(out).filter((c) => !c.countIn);
      expect(beats[0]).toEqual({
        kind: 'click',
        time: 2.05,
        beat: 0,
        accent: true,
        countIn: false,
      });
      expect(beats[1]).toMatchObject({ time: 2.55, beat: 1, accent: false });
      expect(notes(out)[0]).toEqual({ time: 2.05, beat: 0 });
    });

    it('reports the count-in and holds the position still during it', () => {
      const transport = new Transport(config(), settings());
      transport.play(0);
      drive(transport, 0, 2500);

      expect(transport.snapshotAt(0.01)).toMatchObject({
        phase: 'countIn',
        beat: 0,
        countIn: null,
      });
      expect(transport.snapshotAt(0.06)).toMatchObject({ phase: 'countIn', beat: 0, countIn: 1 });
      expect(transport.snapshotAt(1.6)).toMatchObject({ phase: 'countIn', beat: 0, countIn: 4 });
      const playing = transport.snapshotAt(2.3);
      expect(playing.phase).toBe('playing');
      expect(playing.beat).toBeCloseTo(0.5, 9);
    });

    it('keeps exact spacing whatever the tick timing', () => {
      const transport = new Transport(config(4), settings({ tempo: 97 }));
      transport.play(0);
      // Irregular ticks: 10–60 ms apart, like a busy main thread.
      const out: Collected = { sounds: [], notices: [] };
      let ms = 0;
      let i = 0;
      while (ms < 12_000) {
        const part = drive(transport, ms, ms);
        out.sounds.push(...part.sounds);
        ms += [10, 60, 25, 41, 33, 17][i++ % 6] ?? 25;
      }
      const beatClicks = clicks(out).filter((c) => !c.countIn);
      expect(beatClicks.map((c) => c.beat)).toEqual(Array.from({ length: 16 }, (_, b) => b));
      const spacing = 60 / 97;
      beatClicks.forEach((click, b) => {
        expect(click.time).toBeCloseTo(0.05 + (4 + b) * spacing, 9);
      });
      expect(notes(out).map((n) => n.beat)).toEqual(beatClicks.map((c) => c.beat));
    });

    it('counts in six beats in 6/8', () => {
      const transport = new Transport(config(2, { beatsPerBar: 6, totalBeats: 12 }), settings());
      transport.play(0);
      const out = drive(transport, 0, 3500);
      expect(clicks(out).filter((c) => c.countIn)).toHaveLength(6);
      expect(clicks(out).find((c) => !c.countIn)?.time).toBeCloseTo(0.05 + 6 * 0.5, 9);
    });

    it('converts durations to seconds at the current tempo', () => {
      const transport = new Transport(config(), settings({ tempo: 60 }));
      transport.play(0);
      const out = drive(transport, 0, 5000);
      const first = out.sounds.find((s) => s.kind === 'music');
      expect(first).toMatchObject({ time: 4.05, duration: 1 });
    });
  });

  describe('tempo', () => {
    it('changes tempo from the scheduling horizon without a jump', () => {
      const transport = new Transport(config(4), settings({ tempo: 120 }));
      transport.play(0);
      const before = drive(transport, 0, 3000);
      const beatBefore = transport.snapshotAt(3).beat;
      transport.setTempo(60, 3);
      expect(transport.snapshotAt(3).beat).toBeCloseTo(beatBefore, 9);
      const after = drive(transport, 3025, 8000);

      const all = [...clicks(before), ...clicks(after)].filter((c) => !c.countIn);
      // Beat 2 (at 3.05 s) was already scheduled at 120 BPM; from 3.1 s (beat 2.1) it is
      // 60 BPM, so beat 3 comes 0.9 s later.
      expect(all.slice(0, 3).map((c) => c.time)).toEqual([2.05, 2.55, 3.05]);
      expect(all[3]?.time).toBeCloseTo(4, 9);
      expect((all[4]?.time ?? 0) - (all[3]?.time ?? 0)).toBeCloseTo(1, 9);
      expect(transport.snapshotAt(6).tempo).toBe(60);
    });

    it('clamps and rounds tempo', () => {
      expect(clampTempo(10)).toBe(30);
      expect(clampTempo(500)).toBe(220);
      expect(clampTempo(99.6)).toBe(100);
      expect(clampTempo(Number.NaN)).toBe(30);
      const transport = new Transport(config(), settings({ tempo: 5 }));
      expect(transport.settings.tempo).toBe(30);
    });

    it('applies a tempo change during the count-in to the remaining clicks', () => {
      const transport = new Transport(config(), settings({ tempo: 120 }));
      transport.play(0);
      drive(transport, 0, 500);
      transport.setTempo(60, 0.5);
      const out = drive(transport, 525, 6000);
      // Clicks up to 0.6 s (virtual beat −2.9) were scheduled; −2 comes 0.9 s later at 60 BPM.
      const countIn = clicks(out).filter((c) => c.countIn);
      expect(countIn[0]?.time).toBeCloseTo(1.5, 9);
      expect(countIn.map((c) => c.beat)).toEqual([-2, -1]);
    });
  });

  describe('pause and resume', () => {
    it('freezes the position exactly and schedules nothing more', () => {
      const transport = new Transport(config(4), settings());
      transport.play(0);
      drive(transport, 0, 3200);
      const at = transport.snapshotAt(3.2).beat;
      transport.pause(3.2);

      expect(transport.status).toBe('paused');
      for (const time of [3.2, 3.5, 10, 100]) {
        expect(transport.snapshotAt(time)).toMatchObject({ phase: 'paused', beat: at });
      }
      expect(drive(transport, 3225, 6000).sounds).toEqual([]);
    });

    it('resumes from the same position after a one-bar count-in, on the beat grid', () => {
      const transport = new Transport(config(4), settings());
      transport.play(0);
      drive(transport, 0, 3200);
      transport.pause(3.2); // beat 2.3
      const paused = transport.snapshotAt(3.2).beat;
      expect(paused).toBeCloseTo(2.3, 9);

      transport.play(10);
      const out = drive(transport, 10_000, 14_000);
      const countIn = clicks(out).filter((c) => c.countIn);
      expect(countIn.map((c) => c.time)).toEqual([10.05, 10.55, 11.05, 11.55]);
      // Virtual beats −1…2 keep the grid: the next real click is beat 3, a beat later.
      expect(countIn.map((c) => c.beat)).toEqual([-1, 0, 1, 2]);
      const firstBeat = clicks(out).find((c) => !c.countIn);
      expect(firstBeat).toMatchObject({ beat: 3 });
      expect(firstBeat?.time).toBeCloseTo(12.05, 9);
      // Held at the paused beat until the music restarts at 12.05 − 0.7 × 0.5 s.
      expect(transport.snapshotAt(11.69)).toMatchObject({ phase: 'countIn', beat: paused });
      expect(transport.snapshotAt(11.71).phase).toBe('playing');
      expect(transport.snapshotAt(11.75).beat).toBeCloseTo(2.3 + 0.05 / 0.5, 9);
      // Notes from the paused beat on are played again.
      expect(notes(out)[0]).toMatchObject({ beat: 3 });
    });

    it('reports a resume as starting straight away, during the start delay', () => {
      const transport = new Transport(config(4), settings());
      transport.play(0);
      drive(transport, 0, 3000);
      transport.pause(3);
      transport.play(10);
      expect(transport.snapshotAt(10.01)).toMatchObject({
        phase: 'countIn',
        beat: transport.snapshotAt(9).beat,
        countIn: null,
      });
      transport.restart(10.5);
      expect(transport.snapshotAt(10.52)).toMatchObject({ phase: 'countIn', beat: 0 });
    });

    it('starts the count-in again when paused during it', () => {
      const transport = new Transport(config(), settings());
      transport.play(0);
      drive(transport, 0, 1000);
      transport.pause(1);
      expect(transport.snapshotAt(2)).toMatchObject({ phase: 'paused', beat: 0 });
      transport.play(5);
      const out = drive(transport, 5000, 7500);
      expect(clicks(out).filter((c) => c.countIn)).toHaveLength(4);
      expect(clicks(out).find((c) => !c.countIn)?.time).toBeCloseTo(7.05, 9);
    });

    it('ignores play while playing and pause while idle', () => {
      const transport = new Transport(config(), settings());
      transport.pause(1);
      expect(transport.status).toBe('idle');
      transport.play(0);
      transport.play(0.01);
      const out = drive(transport, 0, 1000);
      expect(clicks(out).map((c) => c.time)).toEqual([0.05, 0.55, 1.05]);
    });
  });

  describe('end, loop and speed-up', () => {
    it('finishes at the exact end of the exercise', () => {
      const transport = new Transport(config(1), settings());
      transport.play(0);
      const out = drive(transport, 0, 5000);
      expect(out.notices).toEqual([{ kind: 'finished', time: 4.05 }]);
      expect(transport.status).toBe('finished');
      expect(transport.snapshotAt(4.06)).toMatchObject({ phase: 'finished', beat: 4 });
      expect(transport.snapshotAt(4.04).phase).toBe('playing');

      transport.play(6);
      const again = drive(transport, 6000, 8100);
      expect(clicks(again).filter((c) => c.countIn)).toHaveLength(4);
      expect(transport.snapshotAt(8.06)).toMatchObject({ phase: 'playing', pass: 1 });
    });

    it('loops seamlessly between bars', () => {
      const transport = new Transport(config(4), settings({ loop: { start: 4, end: 12 } }));
      transport.play(0);
      const out = drive(transport, 0, 6500);
      expect(transport.snapshotAt(6.3)).toMatchObject({ phase: 'playing', pass: 2 });
      expect(transport.snapshotAt(6.3).beat).toBeCloseTo(4.5, 9);
      const more = drive(transport, 6525, 12_000);
      out.sounds.push(...more.sounds);
      const beatClicks = clicks(out).filter((c) => !c.countIn);
      expect(beatClicks.slice(0, 10).map((c) => c.beat)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 4, 5]);
      beatClicks.forEach((click, i) => {
        expect(click.time).toBeCloseTo(2.05 + i * 0.5, 9);
      });
      expect(beatClicks[0]?.accent).toBe(true);
      expect(out.notices[0]).toEqual({
        kind: 'pass',
        time: 6.05,
        pass: 1,
        tempo: 120,
        previousTempo: 120,
      });
    });

    it('speeds up after each pass until the target', () => {
      const transport = new Transport(
        config(1),
        settings({ tempo: 60, speedUp: { step: 5, target: 70 } }),
      );
      transport.play(0);
      const out = drive(transport, 0, 30_000);
      const passes = out.notices.filter((n) => n.kind === 'pass');
      expect(passes.slice(0, 4).map((n) => [n.previousTempo, n.tempo])).toEqual([
        [60, 65],
        [65, 70],
        [70, 70],
        [70, 70],
      ]);
      // Without a loop it repeats the whole exercise, at 60 then 65 then 70 BPM.
      expect(passes[0]?.time).toBeCloseTo(0.05 + 8 * 1, 9);
      expect(passes[1]?.time).toBeCloseTo(8.05 + (4 * 60) / 65, 9);
      expect(transport.settings.tempo).toBe(70);
      expect(out.notices.some((n) => n.kind === 'finished')).toBe(false);
    });

    it('asks the pass judge before speeding up', () => {
      const judgePass = vi.fn(({ pass }: { pass: number }) => pass % 2 === 0);
      const transport = new Transport(
        config(1, { judgePass }),
        settings({ tempo: 100, speedUp: { step: 4, target: 120 } }),
      );
      transport.play(0);
      const out = drive(transport, 0, 15_000);
      const passes = out.notices.filter((n) => n.kind === 'pass');
      expect(passes.slice(0, 4).map((n) => n.tempo)).toEqual([100, 104, 104, 108]);
      expect(judgePass).toHaveBeenCalledWith({ pass: 1, endTime: passes[0]?.time });
    });

    it('undoes a loop wrap that was scheduled but not heard when pausing', () => {
      const transport = new Transport(
        config(1),
        settings({ tempo: 60, speedUp: { step: 5, target: 80 } }),
      );
      transport.play(0);
      // The wrap at 8.05 s is scheduled by the tick at 7.975 s.
      drive(transport, 0, 8000);
      expect(transport.settings.tempo).toBe(65);
      transport.pause(8.02);
      expect(transport.settings.tempo).toBe(60);
      expect(transport.snapshotAt(9).beat).toBeCloseTo(4 - 0.03, 9);

      transport.play(20);
      const out = drive(transport, 20_000, 26_000);
      const passes = out.notices.filter((n) => n.kind === 'pass');
      expect(passes[0]).toMatchObject({ pass: 1, previousTempo: 60, tempo: 65 });
    });

    it('jumps to the loop start when the loop moves away from the position', () => {
      const transport = new Transport(config(4), settings());
      transport.play(0);
      drive(transport, 0, 3000); // beat 1.9
      transport.setLoop({ start: 8, end: 12 }, 3);
      const out = drive(transport, 3025, 5000);
      const beatClicks = clicks(out).filter((c) => !c.countIn);
      expect(beatClicks[0]?.beat).toBe(8);
      expect(transport.snapshotAt(3.2).beat).toBeCloseTo(8 + 0.1 / 0.5, 9);
    });

    it('keeps playing when the new loop contains the position', () => {
      const transport = new Transport(config(4), settings());
      transport.play(0);
      drive(transport, 0, 3000);
      transport.setLoop({ start: 0, end: 4 }, 3);
      const out = drive(transport, 3025, 5000);
      expect(clicks(out).map((c) => c.beat)).toEqual([3, 0, 1, 2]);
    });

    it('rejects an invalid loop', () => {
      const transport = new Transport(config(2), settings());
      expect(() => {
        transport.setLoop({ start: 4, end: 4 }, 0);
      }).toThrow(RangeError);
      expect(() => {
        transport.setLoop({ start: 0, end: 12 }, 0);
      }).toThrow(RangeError);
    });
  });

  describe('restart', () => {
    it('restarts from the top with a count-in while playing', () => {
      const transport = new Transport(config(4), settings({ tempo: 90 }));
      transport.play(0);
      drive(transport, 0, 5000);
      transport.restart(5);
      const out = drive(transport, 5000, 8000);
      expect(
        clicks(out)
          .filter((c) => c.countIn)
          .map((c) => c.time)[0],
      ).toBe(5.05);
      expect(transport.settings.tempo).toBe(90);
      expect(transport.snapshotAt(5.1)).toMatchObject({ phase: 'countIn', beat: 0, pass: 1 });
    });

    it('resets to the start when paused', () => {
      const transport = new Transport(config(4), settings({ loop: { start: 4, end: 8 } }));
      transport.play(0);
      drive(transport, 0, 3000);
      transport.pause(3);
      transport.restart(4);
      expect(transport.status).toBe('idle');
      expect(transport.snapshotAt(5)).toMatchObject({ phase: 'idle', beat: 4 });
    });
  });

  describe('wait mode', () => {
    it('waits at each target until told to carry on', () => {
      const transport = new Transport(config(2), settings({ waitMode: true }));
      transport.play(0);
      const first = drive(transport, 0, 500);
      expect(first.notices).toEqual([{ kind: 'waiting', time: 0.05, beat: 0 }]);
      expect(first.sounds).toEqual([]);
      expect(transport.status).toBe('waiting');
      expect(transport.snapshotAt(0.5)).toMatchObject({ phase: 'waiting', beat: 0 });

      transport.advanceWait(1);
      const second = drive(transport, 1000, 5000);
      // The awaited note at beat 0 was played by the player; carry on from beat 1.
      expect(notes(second).map((n) => n.beat)).toEqual([1, 2, 3]);
      expect(notes(second)[0]?.time).toBeCloseTo(1.55, 9);
      expect(second.notices).toEqual([{ kind: 'waiting', time: 3.05, beat: 4 }]);
      expect(transport.snapshotAt(4)).toMatchObject({ phase: 'waiting', beat: 4 });
    });

    it('carries on seamlessly when the target is played before it is reached', () => {
      const transport = new Transport(config(2), settings({ waitMode: true }));
      transport.play(0);
      drive(transport, 0, 100);
      transport.advanceWait(0.1);
      drive(transport, 100, 1950);
      // The stop at beat 4 (2.15 s) is scheduled by the tick at 2.05 s; advance before it.
      drive(transport, 1975, 2075);
      expect(transport.status).toBe('waiting');
      transport.advanceWait(2.08);
      const out = drive(transport, 2100, 3000);
      expect(notes(out)[0]).toMatchObject({ beat: 5 });
      expect(notes(out)[0]?.time).toBeCloseTo(2.15 + 0.5, 9);
    });

    it('carries on without skipping when wait mode is turned off', () => {
      const transport = new Transport(config(2), settings({ waitMode: true }));
      transport.play(0);
      drive(transport, 0, 100);
      transport.setWaitMode(false, 1);
      const out = drive(transport, 1000, 2000);
      expect(notes(out)[0]).toMatchObject({ beat: 0, time: 1.05 });
    });

    it('stops at the next target when wait mode is turned on while playing', () => {
      const transport = new Transport(config(2), settings());
      transport.play(0);
      drive(transport, 0, 2500); // beat 0.9
      transport.setWaitMode(true, 2.5);
      const out = drive(transport, 2525, 5000);
      expect(out.notices).toEqual([{ kind: 'waiting', time: 4.05, beat: 4 }]);
    });

    it('waits at the loop start after each wrap', () => {
      const transport = new Transport(
        config(2),
        settings({ waitMode: true, loop: { start: 4, end: 8 } }),
      );
      transport.play(0);
      drive(transport, 0, 100);
      transport.advanceWait(0.2);
      const out = drive(transport, 200, 3000);
      expect(out.notices.map((n) => n.kind)).toEqual(['pass', 'waiting']);
      expect(transport.snapshotAt(3)).toMatchObject({ phase: 'waiting', beat: 4, pass: 2 });
    });

    it('pausing while waiting resumes waiting at the same target', () => {
      const transport = new Transport(config(2), settings({ waitMode: true }));
      transport.play(0);
      drive(transport, 0, 100);
      transport.pause(1);
      expect(transport.status).toBe('paused');
      transport.play(2);
      const out = drive(transport, 2000, 2200);
      expect(out.notices).toEqual([{ kind: 'waiting', time: 2.05, beat: 0 }]);
    });
  });
});
