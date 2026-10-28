import type { Song } from '@/content/songs';

/** The song's form and each section's chords, bar by bar. */
export function SongChart({ song }: { song: Song }) {
  const { beats, unit } = song.exercise.timeSignature;
  const melody = song.exercise.kind === 'notes';
  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        <span className="font-semibold text-fg">Form: </span>
        {song.form.map((part) => part.name).join(' → ')}
        <span>
          {' '}
          · {beats}/{unit} · {song.exercise.tempo} BPM
        </span>
      </p>
      {song.sections.map((section) => (
        <section key={section.id} aria-label={section.name}>
          <h3 className="mb-1.5 text-sm font-semibold">
            {section.name}
            {melody && <span className="font-normal text-fg-muted"> · backing chords</span>}
          </h3>
          <ol className="grid grid-cols-4 gap-1.5">
            {section.bars.map((chords, i) => (
              <li
                key={i}
                aria-label={`Bar ${i + 1}: ${chords.join(' then ') || 'no chord'}`}
                className="flex min-h-10 items-center justify-center gap-2 rounded-control border border-border bg-surface-raised px-1 text-sm font-semibold"
              >
                {chords.length > 0 ? (
                  chords.map((chord, j) => <span key={j}>{chord}</span>)
                ) : (
                  <span className="text-fg-subtle">–</span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
