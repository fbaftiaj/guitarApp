/** Chords to learn one at a time, and the changes worth drilling, from the course's open chords. */
export const LEARN_CHORDS = ['Em', 'Am', 'E', 'A', 'D', 'G', 'C'] as const;

export const CHANGE_SETS: readonly (readonly string[])[] = [
  ['Em', 'Am'],
  ['E', 'A'],
  ['A', 'D'],
  ['G', 'C'],
  ['G', 'D'],
  ['C', 'Am'],
  ['G', 'C', 'D'],
  ['Em', 'C', 'G', 'D'],
];
