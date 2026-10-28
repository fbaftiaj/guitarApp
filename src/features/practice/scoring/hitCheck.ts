import type { ChromaEvent } from '@/audio/dsp/chroma';
import type { PitchFrame } from '@/audio/dsp/pitchAnalyzer';
import { centsBetween, midiToFrequency } from '@/lib/music/notes';
import { checkChord } from './chordRecognition';

/** What a target asks for: a chord strummed in a direction, or a single note. */
export type Expected =
  { kind: 'chord'; chordId: string; direction: 'down' | 'up' } | { kind: 'note'; midi: number };

/** A note is right within ±50 cents of its target pitch. */
export const NOTE_TOLERANCE_CENTS = 50;
/** Pitch frames from this long after the onset on describe the new note, not the attack. */
const NOTE_FROM_SECONDS = 0.05;
const NOTE_FRAMES = 3;
const MIN_CLARITY = 0.85;
const MIN_RMS = 0.002;
/** Give up waiting for the chroma or a steady pitch after this long. */
export const CHECK_DEADLINE_SECONDS = 0.3;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? 0;
}

/**
 * Decides whether the sound after one onset is the expected chord (from its
 * chroma) or note (from the steady pitch that follows). Each method returns
 * true or false once decided, null while undecided.
 */
export class HitCheck {
  readonly onsetTime: number;
  private readonly expected: Expected;
  private readonly a4: number;
  private readonly frequencies: number[] = [];

  constructor(onsetTime: number, expected: Expected, a4: number) {
    this.onsetTime = onsetTime;
    this.expected = expected;
    this.a4 = a4;
  }

  chroma(event: ChromaEvent): boolean | null {
    if (this.expected.kind !== 'chord' || event.onsetTime !== this.onsetTime) return null;
    return checkChord(event.chroma, this.expected.chordId, this.expected.direction).correct;
  }

  pitch(frame: PitchFrame): boolean | null {
    if (this.expected.kind !== 'note') return null;
    if (frame.time < this.onsetTime + NOTE_FROM_SECONDS) return null;
    if (frame.frequency > 0 && frame.clarity >= MIN_CLARITY && frame.rms >= MIN_RMS) {
      this.frequencies.push(frame.frequency);
    }
    return this.frequencies.length >= NOTE_FRAMES ? this.decideNote() : null;
  }

  /** Decides with what has arrived once the deadline has passed (`now` on the audio clock). */
  expire(now: number): boolean | null {
    if (now < this.onsetTime + CHECK_DEADLINE_SECONDS) return null;
    return this.expected.kind === 'note' && this.frequencies.length > 0 ? this.decideNote() : false;
  }

  private decideNote(): boolean {
    if (this.expected.kind !== 'note') return false;
    const target = midiToFrequency(this.expected.midi, this.a4);
    return Math.abs(centsBetween(median(this.frequencies), target)) <= NOTE_TOLERANCE_CENTS;
  }
}
