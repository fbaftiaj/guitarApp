import { noteName, spellMidi } from '@/lib/music/notes';
import { cx } from '@/ui/cx';

export interface FretMark {
  /** 1 (high e) … 6 (low E). */
  string: number;
  /** Null = string not played. */
  fret: number | null;
  finger: number | null;
  midi: number | null;
}

interface FretboardProps {
  marks: readonly FretMark[];
  showFingers: boolean;
  showNoteNames: boolean;
  label: string;
}

const STRING_COLORS = [
  'stroke-string-1',
  'stroke-string-2',
  'stroke-string-3',
  'stroke-string-4',
  'stroke-string-5',
  'stroke-string-6',
];
const STRING_GAP = 16;
const TOP = 12;
const NUT_X = 34;
const INLAYS = [3, 5, 7, 9, 12];

/**
 * A horizontal fretboard as seen in tab: high e on top. Shows a chord shape
 * or a single note, with finger numbers and note names when enabled.
 */
export function Fretboard({ marks, showFingers, showNoteNames, label }: FretboardProps) {
  const highest = Math.max(0, ...marks.map((mark) => mark.fret ?? 0));
  const frets = Math.max(5, highest + 1);
  const fretGap = Math.min(52, 300 / frets);
  const width = NUT_X + frets * fretGap + 8;
  const height = TOP * 2 + STRING_GAP * 5 + 12;
  const y = (string: number) => TOP + (string - 1) * STRING_GAP;
  const x = (fret: number) => (fret === 0 ? NUT_X - 16 : NUT_X + (fret - 0.5) * fretGap);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="h-auto w-full">
      {INLAYS.filter((fret) => fret <= frets).map((fret) => (
        <circle key={fret} cx={x(fret)} cy={TOP + STRING_GAP * 2.5} r={4} className="fill-border" />
      ))}
      {Array.from({ length: frets + 1 }, (_, fret) => (
        <line
          key={fret}
          x1={NUT_X + fret * fretGap}
          x2={NUT_X + fret * fretGap}
          y1={TOP}
          y2={y(6)}
          className="stroke-border-strong"
          strokeWidth={fret === 0 ? 4 : 1.5}
        />
      ))}
      {Array.from({ length: frets }, (_, i) => (
        <text
          key={i}
          x={x(i + 1)}
          y={height - 2}
          textAnchor="middle"
          className="fill-fg-subtle text-[9px]"
        >
          {i + 1}
        </text>
      ))}
      {STRING_COLORS.map((color, i) => (
        <line
          key={color}
          x1={NUT_X}
          x2={width - 8}
          y1={y(i + 1)}
          y2={y(i + 1)}
          className={color}
          strokeWidth={1 + i * 0.3}
        />
      ))}

      {marks.map((mark) => {
        const cy = y(mark.string);
        if (mark.fret === null) {
          return (
            <text
              key={mark.string}
              x={x(0)}
              y={cy + 4}
              textAnchor="middle"
              className="fill-fg-muted text-[11px] font-semibold"
            >
              ×
            </text>
          );
        }
        const name = mark.midi !== null && showNoteNames ? noteName(spellMidi(mark.midi)) : null;
        const text = showFingers && mark.finger ? String(mark.finger) : name;
        return (
          <g key={mark.string}>
            <circle
              cx={x(mark.fret)}
              cy={cy}
              r={7}
              className={cx(mark.fret === 0 ? 'fill-surface stroke-accent' : 'fill-accent')}
              strokeWidth={mark.fret === 0 ? 2 : 0}
            />
            {text && (
              <text
                x={x(mark.fret)}
                y={cy + 3.5}
                textAnchor="middle"
                className={cx(
                  'text-[9px] font-bold',
                  mark.fret === 0 ? 'fill-accent-text' : 'fill-accent-fg',
                )}
              >
                {text}
              </text>
            )}
            {name && text !== name && (
              <text
                x={x(mark.fret) + 10}
                y={cy - 5}
                className="fill-fg-muted text-[8px] font-semibold"
              >
                {name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
