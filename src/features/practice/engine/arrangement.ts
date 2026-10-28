import { CHORDS } from '@/content/chords';
import { tryParsePitchClass } from '@/lib/music/notes';
import type { StrumDirection, Timeline } from './timeline';

/**
 * What the app plays along with an exercise, in beats: the guide part (the
 * exercise itself) and a simple backing part (bass on the strong beats, kick
 * and hi-hat). Durations are in beats; the transport converts both to
 * audio-clock times.
 */
export type MusicalEvent =
  | {
      part: 'guide';
      kind: 'strum';
      beat: number;
      duration: number;
      direction: StrumDirection;
      /** On the first beat of a bar. */
      accent: boolean;
      /** MIDI note per string, 6th string first; null = not played. */
      midis: readonly (number | null)[];
    }
  | { part: 'guide'; kind: 'note'; beat: number; duration: number; midi: number }
  | { part: 'backing'; kind: 'bass'; beat: number; duration: number; midi: number }
  | { part: 'backing'; kind: 'kick'; beat: number }
  | { part: 'backing'; kind: 'hat'; beat: number; accent: boolean };

/** Bass roots sit between C2 and B2. */
const BASS_LOW_C = 36;

/** Beats that get a kick and a bass note: 1 and 3 in 4/4, 1 in 3/4, 1 and 4 in 6/8. */
export function isStrongBeat(beatInBar: number, beatsPerBar: number): boolean {
  if (beatInBar === 0) return true;
  if (beatsPerBar > 3 && beatsPerBar % 3 === 0) return beatInBar % 3 === 0;
  return beatsPerBar > 3 && beatsPerBar % 2 === 0 && beatInBar % 2 === 0;
}

export function arrange(timeline: Timeline): MusicalEvent[] {
  const { beatsPerBar, slotsPerBeat, totalBeats } = timeline;
  const events: MusicalEvent[] = [];

  timeline.strums.forEach((strum, i) => {
    // A strum rings until the next one, or to the end of its bar.
    const barEnd = (Math.floor(strum.beat / beatsPerBar) + 1) * beatsPerBar;
    const next = timeline.strums[i + 1]?.beat ?? barEnd;
    events.push({
      part: 'guide',
      kind: 'strum',
      beat: strum.beat,
      duration: next - strum.beat,
      direction: strum.direction,
      accent: strum.beat % beatsPerBar === 0,
      midis: CHORDS.get(strum.chordId)?.midis ?? [],
    });
  });
  for (const note of timeline.notes) {
    events.push({
      part: 'guide',
      kind: 'note',
      beat: note.beat,
      duration: note.duration,
      midi: note.midi,
    });
  }

  for (const segment of timeline.chords) {
    const root = tryParsePitchClass(CHORDS.get(segment.chordId)?.root ?? '');
    if (root === null) continue;
    const end = segment.beat + segment.duration;
    const starts: number[] = [];
    for (let beat = segment.beat; beat < end; beat++) {
      if (beat === segment.beat || isStrongBeat(beat % beatsPerBar, beatsPerBar)) starts.push(beat);
    }
    starts.forEach((beat, i) => {
      const duration = (starts[i + 1] ?? end) - beat;
      events.push({ part: 'backing', kind: 'bass', beat, duration, midi: BASS_LOW_C + root });
    });
  }

  for (let slot = 0; slot < totalBeats * slotsPerBeat; slot++) {
    const beat = slot / slotsPerBeat;
    const onBeat = slot % slotsPerBeat === 0;
    if (onBeat && isStrongBeat(beat % beatsPerBar, beatsPerBar)) {
      events.push({ part: 'backing', kind: 'kick', beat });
    }
    events.push({ part: 'backing', kind: 'hat', beat, accent: onBeat });
  }

  // Stable sort: guide before backing at the same beat.
  return events.sort((a, b) => a.beat - b.beat);
}
