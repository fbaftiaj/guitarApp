import type { Exercise } from '@/content/exercises';
import { cx } from '@/ui/cx';
import { compileExercise, type NoteEvent } from '../../practice/engine/timeline';
import { describeNote } from '../../practice/practiceView';

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
const BEAT_WIDTH = 26;
const LEFT = 18;
const ROW = 12;
const TOP = 8;
const BARS_PER_LINE = 2;
const STRING_FILL = [
  'fill-string-1',
  'fill-string-2',
  'fill-string-3',
  'fill-string-4',
  'fill-string-5',
  'fill-string-6',
];

function describeBar(notes: readonly NoteEvent[]): string {
  return notes
    .map((note) => `${describeNote(note)}${note.finger ? `, finger ${note.finger}` : ''}`)
    .join('; ');
}

/** Static tab of a note exercise, two bars per line, with suggested fingers underneath. */
export function TabView({ exercise }: { exercise: Exercise }) {
  const timeline = compileExercise(exercise);
  const { beatsPerBar, totalBars } = timeline;
  const lines = Array.from({ length: Math.ceil(totalBars / BARS_PER_LINE) }, (_, i) => i);
  const lineBeats = beatsPerBar * BARS_PER_LINE;
  const width = LEFT + lineBeats * BEAT_WIDTH + 4;
  const hasFingers = timeline.notes.some((note) => note.finger !== null);
  const fingerY = TOP + ROW * 5 + 14;
  const height = (hasFingers ? fingerY : TOP + ROW * 5) + 6;

  return (
    <div className="space-y-2">
      {lines.map((line) => {
        const firstBar = line * BARS_PER_LINE;
        const bars = Math.min(BARS_PER_LINE, totalBars - firstBar);
        const start = firstBar * beatsPerBar;
        const notes = timeline.notes.filter(
          (note) => note.bar >= firstBar && note.bar < firstBar + bars,
        );
        const x = (beat: number) => LEFT + (beat - start + 0.5) * BEAT_WIDTH;
        const label = Array.from({ length: bars }, (_, i) => {
          const bar = firstBar + i;
          return `Bar ${bar + 1}: ${describeBar(notes.filter((note) => note.bar === bar))}`;
        }).join('. ');
        return (
          <svg
            key={line}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={label}
            className="h-auto w-full max-w-md"
          >
            {STRING_LABELS.map((name, i) => (
              <g key={name + String(i)}>
                <text
                  x={6}
                  y={TOP + i * ROW + 3}
                  textAnchor="middle"
                  className="fill-fg-subtle text-[8px] font-semibold"
                >
                  {name}
                </text>
                <line
                  x1={LEFT}
                  x2={LEFT + bars * beatsPerBar * BEAT_WIDTH}
                  y1={TOP + i * ROW}
                  y2={TOP + i * ROW}
                  className="stroke-border-strong"
                  strokeWidth={0.75}
                />
              </g>
            ))}
            {Array.from({ length: bars + 1 }, (_, i) => (
              <line
                key={i}
                x1={LEFT + i * beatsPerBar * BEAT_WIDTH}
                x2={LEFT + i * beatsPerBar * BEAT_WIDTH}
                y1={TOP}
                y2={TOP + ROW * 5}
                className="stroke-border-strong"
                strokeWidth={1}
              />
            ))}
            {notes.map((note) => (
              <g key={note.index}>
                <rect
                  x={x(note.beat) - 6}
                  y={TOP + (note.string - 1) * ROW - 5}
                  width={12}
                  height={10}
                  rx={2}
                  className="fill-surface"
                />
                <text
                  x={x(note.beat)}
                  y={TOP + (note.string - 1) * ROW + 3.5}
                  textAnchor="middle"
                  className={cx('text-[10px] font-bold', STRING_FILL[note.string - 1])}
                >
                  {note.fret}
                </text>
                {note.finger !== null && (
                  <text
                    x={x(note.beat)}
                    y={fingerY}
                    textAnchor="middle"
                    className="fill-fg-muted text-[8px] font-semibold"
                  >
                    {note.finger}
                  </text>
                )}
              </g>
            ))}
          </svg>
        );
      })}
      {hasFingers && (
        <p className="text-xs text-fg-muted">Small numbers under the tab are suggested fingers.</p>
      )}
    </div>
  );
}
