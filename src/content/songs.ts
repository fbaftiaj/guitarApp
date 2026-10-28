import { z } from 'zod/mini';
import { skillIdSchema, type SkillId } from '@/storage/types';
import {
  buildExercise,
  checkMusic,
  chordBarSchema,
  noteBarSchema,
  tempoSchema,
  timeSignatureSchema,
  type Exercise,
  type MusicData,
} from './exercises';
import { parseOrThrow, report, slug, text } from './schemaParts';
import songsJson from './songs.json';

/**
 * The song library, validated when the module loads. Only traditional,
 * public-domain or original music, and no lyrics: a song is its chords (or
 * melody), rhythm, tempo and sections. The form lists sections in playing
 * order, so a chorus is written once and played as often as needed.
 */

export type SongOrigin = 'traditional' | 'public-domain' | 'original';

export interface SongSection {
  id: string;
  name: string;
  /** Chords per bar; a melody's bars list their backing chord, if any. */
  bars: readonly (readonly string[])[];
}

export interface SongPart {
  sectionId: string;
  name: string;
  /** 1-based bar where this part starts in the full song. */
  startBar: number;
}

export interface Song {
  id: string;
  title: string;
  origin: SongOrigin;
  /** Composer, collector or source, with dates where known. */
  credit: string;
  description: string;
  skills: readonly SkillId[];
  /** Course stage the song suits. */
  stage: number;
  sections: readonly SongSection[];
  form: readonly SongPart[];
  /** Distinct chords, in order of first use. */
  chords: readonly string[];
  /** The whole song as music, e.g. for a lesson to build its own exercise from. */
  music: MusicData;
  exercise: Exercise;
}

const songCommon = {
  id: slug,
  title: text,
  origin: z.enum(['traditional', 'public-domain', 'original']),
  credit: text,
  description: text,
  skills: z.array(skillIdSchema).check(z.minLength(1)),
  stage: z.int().check(z.gte(1), z.lte(8)),
  timeSignature: timeSignatureSchema,
  tempo: tempoSchema,
  form: z.array(slug).check(z.minLength(1)),
};

const section = <T extends z.ZodMiniType>(bar: T) =>
  z.object({ id: slug, name: text, bars: z.array(bar).check(z.minLength(1)) });

const songDataSchema = z.discriminatedUnion('kind', [
  z.object({
    ...songCommon,
    kind: z.literal('chords'),
    strum: z.string(),
    sections: z.array(section(chordBarSchema)).check(z.minLength(1)),
  }),
  z.object({
    ...songCommon,
    kind: z.literal('notes'),
    sections: z.array(section(noteBarSchema)).check(z.minLength(1)),
  }),
]);
type SongData = z.infer<typeof songDataSchema>;

/** The bars of the named sections, in order, as music. */
function sectionMusic(song: SongData, ids: readonly string[]): MusicData {
  const { timeSignature, tempo } = song;
  if (song.kind === 'chords') {
    const bars = ids.flatMap((id) => song.sections.find((part) => part.id === id)?.bars ?? []);
    return { kind: 'chords', timeSignature, tempo, strum: song.strum, bars };
  }
  const bars = ids.flatMap((id) => song.sections.find((part) => part.id === id)?.bars ?? []);
  return { kind: 'notes', timeSignature, tempo, bars };
}

function checkSong(song: SongData, issues: string[]): void {
  const where = `song "${song.id}"`;
  const ids = new Set<string>();
  for (const part of song.sections) {
    if (ids.has(part.id)) issues.push(`${where}: duplicate section id "${part.id}"`);
    ids.add(part.id);
    checkMusic(sectionMusic(song, [part.id]), `${where}, section "${part.id}"`, issues);
    if (!song.form.includes(part.id)) issues.push(`${where}: section "${part.id}" is never played`);
  }
  for (const id of song.form) {
    if (!ids.has(id)) issues.push(`${where}: the form names unknown section "${id}"`);
  }
}

export const songLibrarySchema = z
  .object({ songs: z.array(songDataSchema).check(z.minLength(1)) })
  .check(
    z.superRefine((library, ctx) => {
      const issues: string[] = [];
      const ids = new Set<string>();
      for (const song of library.songs) {
        if (ids.has(song.id)) issues.push(`duplicate song id "${song.id}"`);
        ids.add(song.id);
        checkSong(song, issues);
      }
      report(issues, ctx);
    }),
  );

function buildSong(song: SongData): Song {
  const chordsOf = (bar: SongData['sections'][number]['bars'][number]): readonly string[] =>
    'chords' in bar ? bar.chords : bar.chord === undefined ? [] : [bar.chord];
  const played = song.form.flatMap((id) => {
    const part = song.sections.find((candidate) => candidate.id === id);
    return part ? [part] : [];
  });

  let startBar = 1;
  const form = played.map((part) => {
    const entry = { sectionId: part.id, name: part.name, startBar };
    startBar += part.bars.length;
    return entry;
  });
  const music = sectionMusic(song, song.form);
  return {
    id: song.id,
    title: song.title,
    origin: song.origin,
    credit: song.credit,
    description: song.description,
    skills: song.skills,
    stage: song.stage,
    sections: song.sections.map((part) => ({
      id: part.id,
      name: part.name,
      bars: part.bars.map(chordsOf),
    })),
    form,
    chords: [...new Set(played.flatMap((part) => part.bars.flatMap(chordsOf)))],
    music,
    exercise: buildExercise(song, music),
  };
}

export function parseSongLibrary(data: unknown): readonly Song[] {
  return parseOrThrow(songLibrarySchema, data, 'song library').songs.map(buildSong);
}

export const SONGS = parseSongLibrary(songsJson);

export function findSong(id: string): Song | undefined {
  return SONGS.find((song) => song.id === id);
}
