import type { SkillId } from '@/storage/types';

export const SKILL_LABELS: Record<SkillId, { name: string; description: string }> = {
  chords: { name: 'Chords', description: 'The right chord, every string ringing' },
  chordChanges: { name: 'Chord changes', description: 'Landing each new chord on time, at speed' },
  rhythm: { name: 'Rhythm and timing', description: 'Playing right on the beat' },
  strumming: { name: 'Strumming', description: 'Steady strums, down and up' },
  singleNotes: { name: 'Single notes', description: 'The right note, on time' },
  lead: { name: 'Lead techniques', description: 'Scales, bends and slides, from Stage 6' },
  theory: { name: 'Theory', description: 'Reading tab, chord diagrams and rhythms' },
};
