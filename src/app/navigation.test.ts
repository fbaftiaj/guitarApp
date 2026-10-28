import { describe, expect, it } from 'vitest';
import { PRACTICE_PATH, safeAppPath, trainerPath } from './navigation';

describe('trainerPath', () => {
  it('puts the chords, the mode and the way back in the query', () => {
    const path = trainerPath({ chords: ['G', 'C'], learn: false, back: '/practice' });
    const url = new URL(path, 'https://app.invalid');
    expect(url.pathname).toBe('/trainer');
    expect(url.searchParams.get('chords')).toBe('G,C');
    expect(url.searchParams.get('learn')).toBe('0');
    expect(url.searchParams.get('back')).toBe('/practice');
    expect(trainerPath({ chords: ['Em'], learn: true })).toBe('/trainer?chords=Em&learn=1');
  });
});

describe('safeAppPath', () => {
  it('follows app paths, with their query and hash', () => {
    expect(safeAppPath('/profile/chords/Em', PRACTICE_PATH)).toBe('/profile/chords/Em');
    expect(safeAppPath('/learn/lesson/x/practice?a=1#top', PRACTICE_PATH)).toBe(
      '/learn/lesson/x/practice?a=1#top',
    );
  });

  it.each([
    null,
    '',
    'profile',
    'https://example.com/',
    'javascript:alert(1)',
    '//example.com',
    '/\\example.com',
    '/\t/example.com',
    '/\n/example.com',
  ])('falls back for %j', (path) => {
    expect(safeAppPath(path, PRACTICE_PATH)).toBe(PRACTICE_PATH);
  });
});
