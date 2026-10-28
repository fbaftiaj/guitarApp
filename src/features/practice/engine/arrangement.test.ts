// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findExercise } from '@/content/exercises';
import { arrange, isStrongBeat, type MusicalEvent } from './arrangement';
import { compileExercise } from './timeline';

function arrangement(id: string): MusicalEvent[] {
  const exercise = findExercise(id);
  if (!exercise) throw new Error(`missing exercise ${id}`);
  return arrange(compileExercise(exercise));
}

describe('arrange', () => {
  it('strums the chord shape for as long as each strum rings', () => {
    const strums = arrangement('g-c-d-folk').filter((e) => e.kind === 'strum');
    expect(strums[0]).toEqual({
      part: 'guide',
      kind: 'strum',
      beat: 0,
      duration: 1,
      direction: 'down',
      accent: true,
      midis: [43, 47, 50, 55, 59, 67],
    });
    expect(strums.slice(1, 6).map((s) => [s.beat, s.duration])).toEqual([
      [1, 0.5],
      [1.5, 1],
      [2.5, 0.5],
      [3, 0.5],
      [3.5, 0.5],
    ]);
  });

  it('holds the last strum to the end of its bar', () => {
    const strums = arrangement('am-e-waltz').filter((e) => e.kind === 'strum');
    expect(strums.at(-1)).toMatchObject({ beat: 21, duration: 3 });
  });

  it('plays guide notes at their pitch and length', () => {
    const notes = arrangement('e-minor-riff').filter((e) => e.kind === 'note');
    expect(notes).toHaveLength(28);
    expect(notes[0]).toEqual({ part: 'guide', kind: 'note', beat: 0, duration: 0.5, midi: 40 });
  });

  it('puts the bass on the chord roots on strong beats and chord changes', () => {
    const bass = arrangement('a-d-half-bars').filter((e) => e.kind === 'bass');
    expect(bass.slice(0, 2)).toEqual([
      { part: 'backing', kind: 'bass', beat: 0, duration: 2, midi: 45 },
      { part: 'backing', kind: 'bass', beat: 2, duration: 2, midi: 38 },
    ]);
    const waltzBass = arrangement('am-e-waltz').filter((e) => e.kind === 'bass');
    expect(waltzBass.slice(0, 2).map((e) => [e.beat, e.duration])).toEqual([
      [0, 3],
      [3, 3],
    ]);
  });

  it('adds kick on strong beats and a hi-hat on every strum slot', () => {
    const events = arrangement('em-am-changes');
    const firstBar = events.filter((e) => e.beat < 4);
    expect(firstBar.filter((e) => e.kind === 'kick').map((e) => e.beat)).toEqual([0, 2]);
    expect(firstBar.filter((e) => e.kind === 'hat').map((e) => e.beat)).toEqual([
      0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5,
    ]);
  });

  it('sorts events by beat', () => {
    const beats = arrangement('e-minor-riff').map((e) => e.beat);
    expect(beats).toEqual([...beats].sort((a, b) => a - b));
  });
});

describe('isStrongBeat', () => {
  it.each([
    [4, [0, 2]],
    [3, [0]],
    [2, [0]],
    [6, [0, 3]],
    [12, [0, 3, 6, 9]],
  ])('in %i beats to the bar: %j', (beatsPerBar, strong) => {
    const beats = Array.from({ length: beatsPerBar }, (_, i) => i);
    expect(beats.filter((beat) => isStrongBeat(beat, beatsPerBar))).toEqual(strong);
  });
});
