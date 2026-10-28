import type { Song } from '@/content/songs';

const ORIGINS: Record<Song['origin'], string> = {
  traditional: 'Traditional',
  'public-domain': 'Public domain',
  original: 'Original',
};

export function originLabel(song: Song): string {
  return ORIGINS[song.origin];
}
