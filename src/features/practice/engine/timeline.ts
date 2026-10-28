import { slotsPerBeat, type Exercise } from '@/content/exercises';
import { STANDARD_TUNING } from '@/lib/music/chords';

/**
 * An exercise laid out on a single beat axis (beat 0 = first downbeat). Beats
 * are counted in the time signature's unit, so 3/4 has 3 beats per bar.
 */

export type StrumDirection = 'down' | 'up';

export interface ChordSegment {
  index: number;
  /** 0-based bar number. */
  bar: number;
  beat: number;
  duration: number;
  chordId: string;
}

export interface StrumEvent {
  beat: number;
  direction: StrumDirection;
  chordId: string;
}

export interface NoteEvent {
  index: number;
  bar: number;
  beat: number;
  duration: number;
  /** Guitar string 1 (high e) … 6 (low E). */
  string: number;
  fret: number;
  finger: number | null;
  midi: number;
}

export interface Timeline {
  exerciseId: string;
  kind: Exercise['kind'];
  beatsPerBar: number;
  beatUnit: 4 | 8;
  /** Strum-grid slots per beat (2 = eighth notes). */
  slotsPerBeat: number;
  totalBars: number;
  totalBeats: number;
  targetTempo: number;
  /** Chords to play (chord exercises) or the harmony behind the notes. */
  chords: readonly ChordSegment[];
  strums: readonly StrumEvent[];
  notes: readonly NoteEvent[];
  /** Start beats of what wait mode waits for: each chord, or each note. */
  targets: readonly number[];
}

export function compileExercise(exercise: Exercise): Timeline {
  const beatsPerBar = exercise.timeSignature.beats;
  const slots = slotsPerBeat(exercise.timeSignature);
  const chords: ChordSegment[] = [];
  const strums: StrumEvent[] = [];
  const notes: NoteEvent[] = [];

  if (exercise.kind === 'chords') {
    exercise.bars.forEach((bar, barIndex) => {
      const barStart = barIndex * beatsPerBar;
      const share = beatsPerBar / bar.chords.length;
      bar.chords.forEach((chordId, j) => {
        chords.push({
          index: chords.length,
          bar: barIndex,
          beat: barStart + j * share,
          duration: share,
          chordId,
        });
      });
      for (let slot = 0; slot < bar.strum.length; slot++) {
        const symbol = bar.strum.charAt(slot);
        if (symbol === '.') continue;
        const beatInBar = slot / slots;
        const chordId = bar.chords[Math.floor(beatInBar / share)] ?? bar.chords[0] ?? '';
        strums.push({
          beat: barStart + beatInBar,
          direction: symbol === 'U' ? 'up' : 'down',
          chordId,
        });
      }
    });
  } else {
    exercise.bars.forEach((bar, barIndex) => {
      const barStart = barIndex * beatsPerBar;
      if (bar.chord) {
        chords.push({
          index: chords.length,
          bar: barIndex,
          beat: barStart,
          duration: beatsPerBar,
          chordId: bar.chord,
        });
      }
      let offset = 0;
      for (const item of bar.notes) {
        if (item.string !== null && item.fret !== null) {
          notes.push({
            index: notes.length,
            bar: barIndex,
            beat: barStart + offset,
            duration: item.beats,
            string: item.string,
            fret: item.fret,
            finger: item.finger,
            midi: (STANDARD_TUNING[6 - item.string] ?? 0) + item.fret,
          });
        }
        offset += item.beats;
      }
    });
  }

  const totalBars = exercise.bars.length;
  return {
    exerciseId: exercise.id,
    kind: exercise.kind,
    beatsPerBar,
    beatUnit: exercise.timeSignature.unit,
    slotsPerBeat: slots,
    totalBars,
    totalBeats: totalBars * beatsPerBar,
    targetTempo: exercise.tempo,
    chords,
    strums,
    notes,
    targets: exercise.kind === 'chords' ? chords.map((c) => c.beat) : notes.map((n) => n.beat),
  };
}

/** Index of the last item starting at or before `beat`, or -1 (items sorted by beat). */
export function indexAtBeat(items: readonly { beat: number }[], beat: number): number {
  let low = 0;
  let high = items.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((items[middle]?.beat ?? Infinity) <= beat + 1e-9) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}
