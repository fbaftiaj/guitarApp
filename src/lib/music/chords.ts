/** Chord qualities and how a guitar chord shape sounds in standard tuning. */

/** Chord tones as semitones above the root. */
export const CHORD_QUALITIES = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dominant7: [0, 4, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  add9: [0, 2, 4, 7],
  power: [0, 7],
} as const satisfies Record<string, readonly number[]>;

export type ChordQuality = keyof typeof CHORD_QUALITIES;

const QUALITY_NAMES: Record<ChordQuality, string> = {
  major: 'major',
  minor: 'minor',
  dominant7: 'seven',
  sus2: 'suss two',
  sus4: 'suss four',
  add9: 'add nine',
  power: 'power chord',
};

/** Open strings in standard tuning as MIDI notes, 6th (low E) to 1st (high e). */
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64] as const;

/** Sorted pitch classes (0 = C) of a chord, e.g. A minor → [0, 4, 9]. */
export function chordPitchClasses(rootPitchClass: number, quality: ChordQuality): number[] {
  return CHORD_QUALITIES[quality]
    .map((interval) => (rootPitchClass + interval) % 12)
    .sort((a, b) => a - b);
}

/** MIDI note of each string for a shape (null = muted), 6th to 1st string. */
export function shapeMidis(
  frets: readonly (number | null)[],
  tuning: readonly number[] = STANDARD_TUNING,
): (number | null)[] {
  return frets.map((fret, i) => (fret === null ? null : (tuning[i] ?? 0) + fret));
}

/** Distinct pitch classes a shape sounds, sorted. */
export function soundingPitchClasses(frets: readonly (number | null)[]): number[] {
  const classes = new Set<number>();
  for (const midi of shapeMidis(frets)) if (midi !== null) classes.add(midi % 12);
  return [...classes].sort((a, b) => a - b);
}

/** "A minor", "G seven" — for screen readers ("Am" is read poorly). */
export function spokenChordName(root: string, quality: ChordQuality): string {
  const letter = root.replace('#', ' sharp').replace('b', ' flat');
  return `${letter} ${QUALITY_NAMES[quality]}`;
}
