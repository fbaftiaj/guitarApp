/**
 * A fake guitarist for the listening tests. It replaces getUserMedia with a
 * stream fed from the app's own AudioContext, and plays synthesised strums or
 * notes into it, timed against the metronome clicks the app schedules (seen
 * by watching OscillatorNode.start). Everything runs on the app's audio
 * clock, so timing is exact apart from the stream's own fixed latency, which
 * latency calibration measures like a real device's.
 *
 * Install with `page.addInitScript(installFakeGuitarist)`.
 */

/** A strum (MIDI per string, 6th first, null = not played) or a single note; null = rest. */
export type GuitarPart =
  | { midis: readonly (number | null)[]; direction?: 'down' | 'up'; offsetMs?: number }
  | { midi: number; offsetMs?: number }
  | null;

export interface FakeGuitaristControls {
  /** Plays `parts[i]` on the i-th click after the first `skipClicks` (the count-in). */
  follow(plan: { skipClicks: number; parts: readonly GuitarPart[] }): void;
  /** Plays a part right away. */
  playNow(part: Exclude<GuitarPart, null>): void;
  /** Parts played so far. */
  played(): number;
  /** The next getUserMedia call rejects with a DOMException of this name. */
  failNextWith(name: string): void;
  /** True while the fake microphone track is live. */
  isLive(): boolean;
}

declare global {
  interface Window {
    fakeGuitarist: FakeGuitaristControls;
  }
}

export function installFakeGuitarist(): void {
  const contexts: AudioContext[] = [];
  const Native = window.AudioContext;
  window.AudioContext = class extends Native {
    constructor(options?: AudioContextOptions) {
      super(options);
      contexts.push(this);
    }
  };

  let destination: MediaStreamAudioDestinationNode | null = null;
  let stream: MediaStream | null = null;
  let failure: string | null = null;
  let plan: { skipClicks: number; parts: readonly GuitarPart[] } | null = null;
  let clicks = 0;
  let played = 0;
  const buffers = new Map<string, AudioBuffer>();

  const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

  /** Additive plucked-string tones: exact pitches, a sharp attack, faster-decaying highs. */
  function render(context: BaseAudioContext, part: Exclude<GuitarPart, null>): AudioBuffer {
    // The timing offset does not change the sound.
    const key = JSON.stringify({ ...part, offsetMs: 0 });
    const cached = buffers.get(key);
    if (cached) return cached;
    let notes: number[];
    if ('midi' in part) {
      notes = [part.midi];
    } else {
      notes = part.midis.flatMap((midi) => (midi === null ? [] : [midi]));
      if (part.direction === 'up') notes = notes.slice(-4).reverse();
    }
    const rate = context.sampleRate;
    const length = Math.round(1.2 * rate);
    const samples = new Float32Array(length);
    notes.forEach((midi, string) => {
      const start = Math.round(string * 0.012 * rate);
      const f0 = frequency(midi);
      for (let harmonic = 1; harmonic <= 10 && f0 * harmonic < rate / 2.2; harmonic++) {
        const w = (2 * Math.PI * f0 * harmonic) / rate;
        const amplitude = 0.12 / harmonic;
        const decay = 2 + harmonic * 0.8;
        const phase = (string * 1.7 + harmonic * 0.9) % (2 * Math.PI);
        for (let n = 0; start + n < length; n++) {
          const t = n / rate;
          const attack = Math.min(1, t / 0.002);
          samples[start + n] =
            (samples[start + n] ?? 0) +
            amplitude * attack * Math.exp(-decay * t) * Math.sin(w * n + phase);
        }
      }
    });
    const buffer = context.createBuffer(1, length, rate);
    buffer.copyToChannel(samples, 0);
    buffers.set(key, buffer);
    return buffer;
  }

  /**
   * Renders the plan's sounds ahead: rendering takes tens of milliseconds, which
   * would otherwise make a part's first strum start late.
   */
  function prerender() {
    if (!destination || !plan) return;
    for (const part of plan.parts) if (part) render(destination.context, part);
  }

  function play(part: Exclude<GuitarPart, null>, when: number) {
    if (!destination) return;
    const source = destination.context.createBufferSource();
    source.buffer = render(destination.context, part);
    source.connect(destination);
    source.start(when + (part.offsetMs ?? 0) / 1000);
    played++;
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied below with the node as `this`
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when = 0) {
    start.call(this, when);
    const isClick = this.type === 'triangle' && this.frequency.value >= 1000;
    if (!isClick || !plan) return;
    const index = clicks++ - plan.skipClicks;
    const part = index >= 0 ? plan.parts[index] : undefined;
    if (part) play(part, when);
  };

  window.fakeGuitarist = {
    follow(next) {
      plan = next;
      clicks = 0;
      prerender();
    },
    playNow(part) {
      if (destination) play(part, destination.context.currentTime + 0.05);
    },
    played: () => played,
    failNextWith(name) {
      failure = name;
    },
    isLive: () => stream?.getAudioTracks().some((track) => track.readyState === 'live') ?? false,
  };

  const getUserMedia = (): Promise<MediaStream> => {
    if (failure) {
      const name = failure;
      failure = null;
      return Promise.reject(new DOMException('Fake microphone failure', name));
    }
    const context = contexts.at(-1);
    if (!context) return Promise.reject(new DOMException('No AudioContext yet', 'NotFoundError'));
    destination = context.createMediaStreamDestination();
    stream = destination.stream;
    prerender();
    return Promise.resolve(stream);
  };

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
}
