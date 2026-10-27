// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveSelection } from '@/content/instruments';
import { midiToFrequency, noteLabel } from '@/lib/music/notes';
import {
  AUTO_SWITCH_MARGIN_CENTS,
  HOLD_TO_TUNE_SECONDS,
  TunerEngine,
  chooseAutoTarget,
  classifyCue,
  type TunerEngineOptions,
  type TunerTarget,
} from './tunerEngine';

function targetsFor(instrumentId: string, a4 = 440): TunerTarget[] {
  return resolveSelection(instrumentId).tuning.strings.map(({ index, note }) => ({
    index,
    note,
    frequency: midiToFrequency(note.midi, a4),
  }));
}

const GUITAR = targetsFor('guitar-6');
const E2 = GUITAR[0]?.frequency ?? 0;
const A2 = GUITAR[1]?.frequency ?? 0;
const D3 = GUITAR[2]?.frequency ?? 0;

function detune(frequency: number, cents: number): number {
  return frequency * 2 ** (cents / 1200);
}

function engine(options: Partial<TunerEngineOptions> = {}) {
  return new TunerEngine({ mode: 'auto', targets: GUITAR, a4: 440, selectedIndex: 0, ...options });
}

/** Feeds a constant frequency for `seconds` at 10 ms per reading; returns all events. */
function hold(tuner: TunerEngine, frequency: number | null, from: number, seconds: number) {
  const events = [];
  for (let t = from; t < from + seconds - 1e-9; t += 0.01)
    events.push(...tuner.update(t, frequency));
  return events;
}

describe('classifyCue', () => {
  it('uses a ±5 cent green zone with a little hysteresis on the way out', () => {
    expect(classifyCue(-5, null)).toBe('in-tune');
    expect(classifyCue(5.5, null)).toBe('sharp');
    expect(classifyCue(-5.5, null)).toBe('flat');
    expect(classifyCue(5.5, 'in-tune')).toBe('in-tune');
    expect(classifyCue(6.5, 'in-tune')).toBe('sharp');
  });
});

describe('chooseAutoTarget', () => {
  it('picks the nearest string', () => {
    expect(chooseAutoTarget(detune(A2, -30), GUITAR, null)).toBe(1);
    expect(chooseAutoTarget(detune(D3, 20), GUITAR, null)).toBe(2);
  });

  it('does not flip between neighbouring strings near the midpoint', () => {
    // A2 → D3 is 500 cents; just past the midpoint D3 is closer, but not by the margin.
    const pastMidpoint = detune(A2, 250 + AUTO_SWITCH_MARGIN_CENTS / 2 - 1);
    expect(chooseAutoTarget(pastMidpoint, GUITAR, 1)).toBe(1);
    expect(chooseAutoTarget(pastMidpoint, GUITAR, null)).toBe(2);

    const clearlyD = detune(A2, 250 + AUTO_SWITCH_MARGIN_CENTS / 2 + 1);
    expect(chooseAutoTarget(clearlyD, GUITAR, 1)).toBe(2);
  });
});

describe('TunerEngine', () => {
  it('starts out listening', () => {
    expect(engine().reading.status).toBe('listening');
  });

  it('shows the detected string, the offset and which way to turn the peg', () => {
    const tuner = engine();

    tuner.update(0, detune(A2, -20));
    expect(tuner.reading).toMatchObject({ status: 'pitch', targetIndex: 1, cue: 'flat' });
    expect(tuner.reading.cents).toBeCloseTo(-20, 6);
    expect(tuner.reading.note && noteLabel(tuner.reading.note)).toBe('A2');

    tuner.update(0.01, detune(A2, 12));
    expect(tuner.reading.cue).toBe('sharp');
  });

  it('measures against the chosen string in manual mode', () => {
    const tuner = engine({ mode: 'manual', selectedIndex: 2 });

    tuner.update(0, A2);

    expect(tuner.reading.targetIndex).toBe(2);
    expect(tuner.reading.cents).toBeCloseTo(-500, 6);
    expect(tuner.reading.cue).toBe('flat');
  });

  it('names any note in chromatic mode, relative to the reference pitch', () => {
    const tuner = engine({ mode: 'chromatic', a4: 442 });

    tuner.update(0, 440);

    expect(tuner.reading.note && noteLabel(tuner.reading.note)).toBe('A4');
    expect(tuner.reading.cents).toBeCloseTo(-7.85, 2);
    expect(tuner.reading.targetIndex).toBeNull();
  });

  it('rides out short dropouts, then goes back to listening', () => {
    const tuner = engine();
    tuner.update(0, A2);

    tuner.update(0.2, null);
    expect(tuner.reading.status).toBe('pitch');

    tuner.update(0.3, null);
    expect(tuner.reading.status).toBe('listening');
  });

  it('ticks a string off after it stays in tune for a second', () => {
    const tuner = engine();

    expect(hold(tuner, detune(E2, 2), 0, HOLD_TO_TUNE_SECONDS - 0.05)).toEqual([]);
    const events = hold(tuner, detune(E2, -3), HOLD_TO_TUNE_SECONDS - 0.05, 0.1);

    expect(events).toEqual([{ type: 'tuned', indices: [0] }]);
    expect([...tuner.tuned]).toEqual([0]);
  });

  it('restarts the hold when the pitch leaves the green zone', () => {
    const tuner = engine();
    hold(tuner, E2, 0, 0.8);
    hold(tuner, detune(E2, 15), 0.8, 0.1);

    expect(hold(tuner, E2, 0.9, 0.9)).toEqual([]);
    expect(hold(tuner, E2, 1.8, 0.2)).toEqual([{ type: 'tuned', indices: [0] }]);
  });

  it('removes the tick from a string that drifts out of tune', () => {
    const tuner = engine();
    hold(tuner, E2, 0, 1.1);

    expect(hold(tuner, detune(E2, 8), 1.1, 1)).toEqual([]);
    expect(hold(tuner, detune(E2, -20), 2.1, 0.6)).toEqual([{ type: 'detuned', indices: [0] }]);
    expect(tuner.tuned.size).toBe(0);
  });

  it('announces when every string is tuned', () => {
    const tuner = engine();
    const events = GUITAR.flatMap((target, i) => [
      ...hold(tuner, target.frequency, i * 2, 1.1),
      ...hold(tuner, null, i * 2 + 1.1, 0.5),
    ]);

    expect(events.filter((event) => event.type === 'tuned')).toHaveLength(6);
    expect(events.at(-1)).toEqual({ type: 'all-tuned' });
  });

  it('ticks unison strings of a 12-string together in auto mode', () => {
    const twelve = targetsFor('guitar-12');
    const tuner = engine({ targets: twelve });
    const b3 = twelve[8]?.frequency ?? 0;

    expect(hold(tuner, b3, 0, 1.1)).toEqual([{ type: 'tuned', indices: [8, 9] }]);
  });

  it('keeps reading but gives no ticks while a reference note plays', () => {
    const tuner = engine();
    tuner.holdTicks(2);

    expect(hold(tuner, E2, 0, 1.9)).toEqual([]);
    expect(tuner.reading).toMatchObject({ status: 'pitch', targetIndex: 0, cue: 'in-tune' });
    // The hold-to-tune second starts counting once the reference has finished.
    expect(hold(tuner, E2, 1.9, 1)).toEqual([]);
    expect(hold(tuner, E2, 2.9, 0.2)).toEqual([{ type: 'tuned', indices: [0] }]);
  });

  it('clears ticks when the tuning or reference pitch changes', () => {
    const tuner = engine();
    hold(tuner, E2, 0, 1.1);
    expect(tuner.tuned.size).toBe(1);

    tuner.configure({ mode: 'manual', targets: GUITAR, a4: 440, selectedIndex: 3 });
    expect(tuner.tuned.size).toBe(1);

    tuner.configure({ mode: 'manual', targets: GUITAR, a4: 442, selectedIndex: 3 });
    expect(tuner.tuned.size).toBe(0);
  });
});
