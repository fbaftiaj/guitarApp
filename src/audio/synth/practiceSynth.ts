import { DEFAULT_A4_HZ, midiToFrequency } from '@/lib/music/notes';
import { createPluckBank, type PluckBank, type ToneTimbre } from './pluckBank';
import { seededRandom } from './random';

/**
 * Sounds for the practicer, each scheduled at an exact audio-clock time:
 * metronome clicks, the guide part (strummed chords and single notes as
 * Karplus–Strong plucks) and a backing part (synth bass, kick and hi-hat).
 *
 * ```
 * metronome ─┐
 * count-in  ─┤ (follows the metronome volume, but plays even when it is off)
 * guide     ─┼─▶ master ─▶ destination
 * backing   ─┘
 * ```
 */

export type PracticeBus = 'metronome' | 'guide' | 'backing';

export interface BusLevel {
  enabled: boolean;
  /** 0–1, mapped to gain on a square curve so the slider feels even. */
  volume: number;
}

export type StrumDirection = 'down' | 'up';

export interface PracticeSynth {
  setBus(bus: PracticeBus, level: BusLevel): void;
  /** Renders plucked notes ahead of time so the first strum costs nothing. */
  prepare(midis: Iterable<number>): void;
  click(time: number, options: { accent: boolean; countIn: boolean }): void;
  /** `midis` per string, 6th string first; null strings are not played. */
  strum(
    time: number,
    options: {
      midis: readonly (number | null)[];
      direction: StrumDirection;
      /** Seconds until the chord is released. */
      duration: number;
      accent: boolean;
    },
  ): void;
  note(time: number, options: { midi: number; duration: number }): void;
  bass(time: number, options: { midi: number; duration: number }): void;
  kick(time: number): void;
  hat(time: number, options: { accent: boolean }): void;
  /** Cancels sounds starting at or after `time` and quickly fades out ringing ones. */
  silenceFrom(time: number): void;
  dispose(): void;
}

export interface PracticeSynthOptions {
  a4?: number;
  timbre?: ToneTimbre;
  bank?: PluckBank;
}

/** Time between strings in a strum. */
export const STRUM_SPREAD_SECONDS = 0.012;
/** Up-strums catch only the treble strings. */
const UP_STRUM_STRINGS = 4;
export const CLICK_FREQUENCIES = { accent: 1760, normal: 1320 } as const;
const MASTER_GAIN = 0.9;
const RELEASE_SECONDS = 0.03;
const SILENCE_SECONDS = 0.01;
const LEVEL_SMOOTHING_SECONDS = 0.015;

interface Voice {
  start: number;
  end: number;
  sources: AudioScheduledSourceNode[];
  /** Per-voice switch, used only to silence it (the envelope sits upstream). */
  output: GainNode;
}

/** A plucked-string bank shared by every practice session: notes render once per app run. */
const sharedBank = createPluckBank({ seconds: 2, limit: 64 });

function safeStop(source: AudioScheduledSourceNode, when: number): void {
  try {
    source.stop(when);
  } catch {
    // Never started, or already stopped.
  }
}

export function createPracticeSynth(
  context: BaseAudioContext,
  { a4 = DEFAULT_A4_HZ, timbre = 'acoustic', bank = sharedBank }: PracticeSynthOptions = {},
): PracticeSynth {
  const master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);

  const levels: Record<PracticeBus, BusLevel> = {
    metronome: { enabled: true, volume: 0.8 },
    guide: { enabled: true, volume: 0.7 },
    backing: { enabled: true, volume: 0.6 },
  };
  const buses = {
    metronome: context.createGain(),
    countIn: context.createGain(),
    guide: context.createGain(),
    backing: context.createGain(),
  };
  for (const bus of Object.values(buses)) bus.connect(master);
  const gainOf = ({ enabled, volume }: BusLevel) =>
    enabled ? Math.max(0, Math.min(1, volume)) ** 2 : 0;
  buses.metronome.gain.value = gainOf(levels.metronome);
  buses.countIn.gain.value = gainOf({ ...levels.metronome, enabled: true });
  buses.guide.gain.value = gainOf(levels.guide);
  buses.backing.gain.value = gainOf(levels.backing);

  let voices: Voice[] = [];
  let noise: AudioBuffer | null = null;

  function noiseBuffer(): AudioBuffer {
    if (!noise) {
      const length = Math.round(0.06 * context.sampleRate);
      const random = seededRandom(7);
      const samples = new Float32Array(length);
      for (let i = 0; i < length; i++) samples[i] = random() * 2 - 1;
      noise = context.createBuffer(1, length, context.sampleRate);
      noise.copyToChannel(samples, 0);
    }
    return noise;
  }

  /** Wires `nodes` → a per-voice output → `bus`, and tracks it for silencing. */
  function addVoice(
    bus: GainNode,
    head: AudioNode,
    sources: AudioScheduledSourceNode[],
    start: number,
    end: number,
  ): void {
    const output = context.createGain();
    head.connect(output);
    output.connect(bus);
    const last = sources.at(-1);
    if (last) {
      last.onended = () => {
        output.disconnect();
      };
    }
    const now = context.currentTime;
    voices = voices.filter((voice) => voice.end > now);
    voices.push({ start, end, sources, output });
  }

  function pluck(midi: number): AudioBufferSourceNode {
    const source = context.createBufferSource();
    source.buffer = bank.get(context, midiToFrequency(midi, a4), timbre);
    return source;
  }

  /** Holds `level` from `time`, then releases at `releaseAt`. */
  function envelope(time: number, level: number, releaseAt: number): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(level, time);
    gain.gain.setValueAtTime(level, releaseAt);
    gain.gain.setTargetAtTime(0, releaseAt, RELEASE_SECONDS / 3);
    return gain;
  }

  function percussive(
    time: number,
    peak: number,
    decaySeconds: number,
    attackSeconds = 0.001,
  ): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + attackSeconds);
    gain.gain.exponentialRampToValueAtTime(0.001, time + attackSeconds + decaySeconds);
    return gain;
  }

  function silenceFrom(time: number): void {
    for (const voice of voices) {
      if (voice.start >= time - 1e-6) {
        // Not started yet: make sure it never plays.
        voice.output.disconnect();
        for (const source of voice.sources) safeStop(source, 0);
      } else if (voice.end > time) {
        voice.output.gain.setTargetAtTime(0, time, SILENCE_SECONDS / 3);
        for (const source of voice.sources) safeStop(source, time + SILENCE_SECONDS * 4);
      }
    }
    voices = voices.filter((voice) => voice.start < time - 1e-6 && voice.end > time);
  }

  return {
    setBus(bus, level) {
      levels[bus] = { ...level };
      const now = context.currentTime;
      buses[bus].gain.setTargetAtTime(gainOf(level), now, LEVEL_SMOOTHING_SECONDS);
      if (bus === 'metronome') {
        buses.countIn.gain.setTargetAtTime(
          gainOf({ ...level, enabled: true }),
          now,
          LEVEL_SMOOTHING_SECONDS,
        );
      }
    },

    prepare(midis) {
      for (const midi of new Set(midis)) bank.get(context, midiToFrequency(midi, a4), timbre);
    },

    click(time, { accent, countIn }) {
      if (!countIn && !levels.metronome.enabled) return;
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = accent ? CLICK_FREQUENCIES.accent : CLICK_FREQUENCIES.normal;
      const gain = percussive(time, accent ? 0.9 : 0.65, 0.04);
      oscillator.connect(gain);
      oscillator.start(time);
      oscillator.stop(time + 0.06);
      addVoice(countIn ? buses.countIn : buses.metronome, gain, [oscillator], time, time + 0.06);
    },

    strum(time, { midis, direction, duration, accent }) {
      if (!levels.guide.enabled) return;
      let strings = midis.flatMap((midi) => (midi === null ? [] : [midi]));
      if (direction === 'up') strings = strings.slice(-UP_STRUM_STRINGS).reverse();
      if (strings.length === 0) return;
      const level =
        (accent ? 0.42 : direction === 'down' ? 0.34 : 0.26) * (4 / strings.length) ** 0.5;
      const releaseAt = time + Math.min(duration, bank.seconds);
      const gain = envelope(time, level, releaseAt);
      const end = releaseAt + RELEASE_SECONDS * 3;
      const sources = strings.map((midi, i) => {
        const source = pluck(midi);
        source.connect(gain);
        source.start(time + i * STRUM_SPREAD_SECONDS);
        source.stop(end);
        return source;
      });
      addVoice(buses.guide, gain, sources, time, end);
    },

    note(time, { midi, duration }) {
      if (!levels.guide.enabled) return;
      const releaseAt = time + Math.min(duration, bank.seconds);
      const gain = envelope(time, 0.6, releaseAt);
      const end = releaseAt + RELEASE_SECONDS * 3;
      const source = pluck(midi);
      source.connect(gain);
      source.start(time);
      source.stop(end);
      addVoice(buses.guide, gain, [source], time, end);
    },

    bass(time, { midi, duration }) {
      if (!levels.backing.enabled) return;
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = midiToFrequency(midi, a4);
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      const releaseAt = time + duration * 0.92;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.55, time + 0.008);
      gain.gain.setTargetAtTime(0.35, time + 0.008, 0.15);
      gain.gain.setTargetAtTime(0, releaseAt, RELEASE_SECONDS / 3);
      oscillator.connect(filter);
      filter.connect(gain);
      const end = releaseAt + RELEASE_SECONDS * 3;
      oscillator.start(time);
      oscillator.stop(end);
      addVoice(buses.backing, gain, [oscillator], time, end);
    },

    kick(time) {
      if (!levels.backing.enabled) return;
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(140, time);
      oscillator.frequency.exponentialRampToValueAtTime(45, time + 0.12);
      const gain = percussive(time, 0.9, 0.28, 0.002);
      oscillator.connect(gain);
      oscillator.start(time);
      oscillator.stop(time + 0.3);
      addVoice(buses.backing, gain, [oscillator], time, time + 0.3);
    },

    hat(time, { accent }) {
      if (!levels.backing.enabled) return;
      const source = context.createBufferSource();
      source.buffer = noiseBuffer();
      const filter = context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      const gain = percussive(time, accent ? 0.22 : 0.13, 0.04);
      source.connect(filter);
      filter.connect(gain);
      source.start(time);
      source.stop(time + 0.05);
      addVoice(buses.backing, gain, [source], time, time + 0.05);
    },

    silenceFrom,

    dispose() {
      silenceFrom(0);
      voices = [];
      master.disconnect();
    },
  };
}
