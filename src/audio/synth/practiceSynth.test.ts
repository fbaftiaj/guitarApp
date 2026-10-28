// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { midiToFrequency } from '@/lib/music/notes';
import { createPluckBank } from './pluckBank';
import {
  CLICK_FREQUENCIES,
  STRUM_SPREAD_SECONDS,
  createPracticeSynth,
  type PracticeSynth,
} from './practiceSynth';

/** Records what the synth asks of Web Audio. */
class FakeParam {
  value = 0;
  readonly calls: [string, ...number[]][] = [];
  setValueAtTime(value: number, time: number) {
    this.calls.push(['set', value, time]);
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.calls.push(['linear', value, time]);
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.calls.push(['exponential', value, time]);
  }
  setTargetAtTime(value: number, time: number, constant: number) {
    this.calls.push(['target', value, time, constant]);
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = [];
  disconnected = false;
  readonly kind: string;
  constructor(kind: string) {
    this.kind = kind;
  }
  connect(node: FakeNode) {
    this.outputs.push(node);
    return node;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
  constructor() {
    super('gain');
  }
}

class FakeSource extends FakeNode {
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  buffer: unknown = null;
  type = '';
  readonly frequency = new FakeParam();
  start(when = 0) {
    this.startedAt = when;
  }
  stop(when = 0) {
    this.stoppedAt = when;
  }
}

function fakeContext() {
  const created: FakeNode[] = [];
  const track = <T extends FakeNode>(node: T): T => {
    created.push(node);
    return node;
  };
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    destination: new FakeNode('destination'),
    createGain: () => track(new FakeGain()),
    createOscillator: () => track(new FakeSource('oscillator')),
    createBufferSource: () => track(new FakeSource('buffer')),
    createBiquadFilter: () =>
      track(Object.assign(new FakeNode('filter'), { type: '', frequency: new FakeParam() })),
    createBuffer: vi.fn((_channels: number, length: number) => ({
      length,
      copyToChannel: vi.fn(),
    })),
  };
  const sources = (kind: string) =>
    created.filter((node): node is FakeSource => node instanceof FakeSource && node.kind === kind);
  return { context, created, sources };
}

function setup() {
  const fake = fakeContext();
  const bank = createPluckBank({ seconds: 0.5, limit: 64 });
  const synth: PracticeSynth = createPracticeSynth(fake.context as unknown as BaseAudioContext, {
    bank,
  });
  return { ...fake, synth };
}

/** Follows the connections from a node to the first bus-level gain under master. */
function pathTo(node: FakeNode, target: FakeNode): boolean {
  if (node === target) return true;
  return node.outputs.some((next) => pathTo(next, target));
}

describe('createPracticeSynth', () => {
  it('connects four buses through a master gain to the speakers', () => {
    const { context, created } = setup();
    const master = created[0] as FakeGain;
    expect(master.outputs).toEqual([context.destination]);
    const buses = created.slice(1, 5) as FakeGain[];
    for (const bus of buses) expect(bus.outputs).toEqual([master]);
    expect(buses.map((bus) => bus.gain.value)).toEqual([0.8 ** 2, 0.8 ** 2, 0.7 ** 2, 0.6 ** 2]);
  });

  it('schedules accented and normal clicks at their exact times', () => {
    const { synth, sources, created } = setup();
    synth.click(1.25, { accent: true, countIn: false });
    synth.click(1.75, { accent: false, countIn: false });
    const [accent, normal] = sources('oscillator');
    expect(accent?.startedAt).toBe(1.25);
    expect(accent?.frequency.value).toBe(CLICK_FREQUENCIES.accent);
    expect(normal?.startedAt).toBe(1.75);
    expect(normal?.frequency.value).toBe(CLICK_FREQUENCIES.normal);
    const metronomeBus = created[1] as FakeGain;
    expect(accent && pathTo(accent, metronomeBus)).toBe(true);
  });

  it('keeps the count-in audible when the metronome is off', () => {
    const { synth, sources, created } = setup();
    synth.setBus('metronome', { enabled: false, volume: 0.5 });
    synth.click(1, { accent: false, countIn: false });
    synth.click(2, { accent: true, countIn: true });
    expect(sources('oscillator').map((o) => o.startedAt)).toEqual([2]);
    const countInBus = created[2] as FakeGain;
    const [click] = sources('oscillator');
    expect(click && pathTo(click, countInBus)).toBe(true);
    // The count-in follows the metronome volume, the metronome bus is muted.
    expect((created[1] as FakeGain).gain.calls.at(-1)).toEqual(['target', 0, 0, 0.015]);
    expect(countInBus.gain.calls.at(-1)).toEqual(['target', 0.25, 0, 0.015]);
  });

  it('creates nothing for a disabled bus', () => {
    const { synth, created } = setup();
    synth.setBus('guide', { enabled: false, volume: 1 });
    synth.setBus('backing', { enabled: false, volume: 1 });
    const before = created.length;
    synth.strum(1, {
      midis: [40, 47, 52, 55, 59, 64],
      direction: 'down',
      duration: 1,
      accent: false,
    });
    synth.note(1, { midi: 60, duration: 1 });
    synth.bass(1, { midi: 40, duration: 1 });
    synth.kick(1);
    synth.hat(1, { accent: true });
    expect(created.length).toBe(before);
  });

  it('strums down from the bass string with a small spread, skipping muted strings', () => {
    const { synth, sources } = setup();
    synth.strum(2, {
      midis: [null, 45, 52, 57, 60, 64],
      direction: 'down',
      duration: 0.4,
      accent: true,
    });
    const plucks = sources('buffer');
    expect(plucks).toHaveLength(5);
    plucks.forEach((pluck, i) => {
      expect(pluck.startedAt).toBeCloseTo(2 + i * STRUM_SPREAD_SECONDS, 12);
      expect(pluck.stoppedAt).toBeCloseTo(2.4 + 0.09, 12);
    });
  });

  it('strums up across the four treble strings, high to low', () => {
    const { synth, sources, context } = setup();
    synth.strum(1, {
      midis: [40, 47, 52, 55, 59, 64],
      direction: 'up',
      duration: 0.3,
      accent: false,
    });
    expect(sources('buffer')).toHaveLength(4);
    // The bank renders each pitch once: high e is the first buffer rendered.
    expect(context.createBuffer).toHaveBeenCalledTimes(4);
  });

  it('releases a guide note at the end of its length', () => {
    const { synth, sources, created } = setup();
    synth.note(3, { midi: 64, duration: 0.25 });
    const [source] = sources('buffer');
    expect(source?.startedAt).toBe(3);
    const envelope = created.find(
      (node): node is FakeGain => node instanceof FakeGain && source?.outputs[0] === node,
    );
    expect(envelope?.gain.calls).toEqual([
      ['set', 0.6, 3],
      ['set', 0.6, 3.25],
      ['target', 0, 3.25, 0.01],
    ]);
  });

  it('plays the backing bass at the chord root pitch', () => {
    const { synth, sources } = setup();
    synth.bass(1, { midi: 45, duration: 1 });
    synth.kick(1);
    synth.hat(1.5, { accent: false });
    const [bass, kick] = sources('oscillator');
    expect(bass?.type).toBe('triangle');
    expect(bass?.frequency.value).toBeCloseTo(midiToFrequency(45), 9);
    expect(kick?.type).toBe('sine');
    expect(sources('buffer')[0]?.startedAt).toBe(1.5);
  });

  it('cancels sounds that have not started and fades out ringing ones', () => {
    const { synth, sources, context } = setup();
    synth.note(1, { midi: 60, duration: 2 });
    synth.click(3, { accent: false, countIn: false });
    context.currentTime = 1.5;
    synth.silenceFrom(1.5);

    const [ringing] = sources('buffer');
    const [pending] = sources('oscillator');
    expect(ringing?.stoppedAt).toBeCloseTo(1.54, 9);
    expect(pending?.stoppedAt).toBe(0);
    expect(pending?.outputs[0]?.outputs[0]?.disconnected).toBe(true);
    const ringingOutput = ringing?.outputs[0]?.outputs[0] as FakeGain | undefined;
    expect(ringingOutput?.gain.calls).toEqual([['target', 0, 1.5, 0.01 / 3]]);
  });

  it('renders each prepared pitch once', () => {
    const { synth, context } = setup();
    synth.prepare([40, 45, 40, 52]);
    synth.prepare([45]);
    expect(context.createBuffer).toHaveBeenCalledTimes(3);
  });
});
