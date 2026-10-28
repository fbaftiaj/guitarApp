// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CHORDS } from './chords';
import { findSong, parseSongLibrary, SONGS } from './songs';
import songsJson from './songs.json';

const verse = { id: 'verse', name: 'Verse', bars: [{ chords: ['G'] }, { chords: ['C'] }] };

function library(overrides: object = {}) {
  return {
    songs: [
      {
        id: 'test-song',
        title: 'Test',
        kind: 'chords',
        origin: 'original',
        credit: 'Test',
        description: 'Test song.',
        skills: ['chords'],
        stage: 1,
        timeSignature: { beats: 4, unit: 4 },
        tempo: 80,
        strum: 'quarters',
        sections: [verse],
        form: ['verse'],
        ...overrides,
      },
    ],
  };
}

describe('song library', () => {
  it('parses the shipped songs with unique ids', () => {
    expect(() => parseSongLibrary(songsJson)).not.toThrow();
    expect(SONGS.length).toBeGreaterThanOrEqual(7);
    expect(new Set(SONGS.map((song) => song.id)).size).toBe(SONGS.length);
  });

  it('only uses traditional, public-domain or original music, and has no lyrics', () => {
    for (const song of SONGS) {
      expect(['traditional', 'public-domain', 'original']).toContain(song.origin);
      expect(song.credit.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(songsJson)).not.toMatch(/"lyrics"|"words"\s*:/i);
  });

  it('only references chords in the chord library', () => {
    for (const song of SONGS) {
      for (const id of song.chords) expect(CHORDS.has(id), `${song.id}: ${id}`).toBe(true);
    }
  });

  it('plays the sections in the order of the form', () => {
    const song = parseSongLibrary(
      library({
        sections: [verse, { id: 'chorus', name: 'Chorus', bars: [{ chords: ['D'] }] }],
        form: ['verse', 'chorus', 'verse'],
      }),
    )[0];
    expect(song?.form).toEqual([
      { sectionId: 'verse', name: 'Verse', startBar: 1 },
      { sectionId: 'chorus', name: 'Chorus', startBar: 3 },
      { sectionId: 'verse', name: 'Verse', startBar: 4 },
    ]);
    expect(song?.chords).toEqual(['G', 'C', 'D']);
    const exercise = song?.exercise;
    expect(exercise?.kind === 'chords' && exercise.bars.map((bar) => bar.chords[0])).toEqual([
      'G',
      'C',
      'D',
      'G',
      'C',
    ]);
    expect(exercise?.kind === 'chords' && exercise.bars[0]?.strum).toBe('D.D.D.D.');
  });

  it('builds melodies with their backing chords', () => {
    const song = findSong('ode-to-joy');
    expect(song?.exercise.kind).toBe('notes');
    expect(song?.chords).toEqual(['C', 'G']);
    expect(song?.form.map((part) => part.startBar)).toEqual([1, 5, 9, 13]);
  });

  it.each([
    [{ form: ['verse', 'bridge'] }, 'the form names unknown section "bridge"'],
    [
      { sections: [verse, { ...verse, id: 'outro' }], form: ['verse'] },
      'section "outro" is never played',
    ],
    [{ sections: [verse, verse] }, 'duplicate section id "verse"'],
    [
      { sections: [{ ...verse, bars: [{ chords: ['Hm'] }] }] },
      'section "verse", bar 1: unknown chord "Hm"',
    ],
    [{ strum: 'waltz' }, 'strum "waltz" has 6 slots, needs 8'],
    [{ origin: 'cover' }, 'origin'],
  ])('rejects %j', (overrides, message) => {
    expect(() => parseSongLibrary(library(overrides))).toThrow(message);
  });

  it('rejects duplicate song ids', () => {
    const { songs } = library();
    expect(() => parseSongLibrary({ songs: [...songs, ...songs] })).toThrow(
      'duplicate song id "test-song"',
    );
  });
});
