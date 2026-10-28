import type { Chord } from '@/content/chords';
import { cx } from '@/ui/cx';

interface ChordDiagramProps {
  chord: Chord;
  showFingers: boolean;
  /** Smaller, dimmed rendering for the upcoming chord. */
  size?: 'md' | 'sm';
  className?: string;
}

const STRING_GAP = 14;
const FRET_GAP = 18;
const FRETS_SHOWN = 4;
const LEFT = 14;
const TOP = 22;
const WIDTH = LEFT * 2 + STRING_GAP * 5;
const HEIGHT = TOP + FRET_GAP * FRETS_SHOWN + 8;

/** First fret drawn: the nut for open-position shapes, else the lowest fretted fret. */
function baseFret(frets: readonly (number | null)[]): number {
  const fretted = frets.filter((fret): fret is number => fret !== null && fret > 0);
  const highest = Math.max(0, ...fretted);
  return highest <= FRETS_SHOWN ? 1 : Math.min(...fretted);
}

function describe(chord: Chord, showFingers: boolean): string {
  const strings = chord.frets.map((fret, i) => {
    const string = 6 - i;
    if (fret === null) return `string ${string} not played`;
    if (fret === 0) return `string ${string} open`;
    const finger = chord.fingers[i];
    return `string ${string} fret ${fret}${showFingers && finger ? ` finger ${finger}` : ''}`;
  });
  return `${chord.name} chord: ${strings.join(', ')}`;
}

/** A standard chord box: strings left (low E) to right (high e), nut at the top. */
export function ChordDiagram({ chord, showFingers, size = 'md', className }: ChordDiagramProps) {
  const base = baseFret(chord.frets);
  const x = (stringIndex: number) => LEFT + stringIndex * STRING_GAP;
  const y = (fret: number) => TOP + (fret - base + 0.5) * FRET_GAP;
  const barre = chord.barre;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={describe(chord, showFingers)}
      className={cx(size === 'md' ? 'w-28' : 'w-20 opacity-80', 'h-auto', className)}
    >
      {/* Frets and the nut */}
      {Array.from({ length: FRETS_SHOWN + 1 }, (_, i) => (
        <line
          key={i}
          x1={x(0)}
          x2={x(5)}
          y1={TOP + i * FRET_GAP}
          y2={TOP + i * FRET_GAP}
          className="stroke-border-strong"
          strokeWidth={i === 0 && base === 1 ? 4 : 1.5}
          strokeLinecap="round"
        />
      ))}
      {chord.frets.map((_, i) => (
        <line
          key={i}
          x1={x(i)}
          x2={x(i)}
          y1={TOP}
          y2={TOP + FRETS_SHOWN * FRET_GAP}
          className="stroke-fg-subtle"
          strokeWidth={1.5 - i * 0.15}
        />
      ))}
      {base > 1 && (
        <text
          x={WIDTH - 2}
          y={y(base) + 4}
          textAnchor="end"
          className="fill-fg-muted text-[9px] font-semibold"
        >
          {base}fr
        </text>
      )}

      {/* Open and muted strings */}
      {chord.frets.map((fret, i) =>
        fret === null ? (
          <text
            key={i}
            x={x(i)}
            y={TOP - 7}
            textAnchor="middle"
            className="fill-fg-muted text-[11px] font-semibold"
          >
            ×
          </text>
        ) : fret === 0 ? (
          <circle
            key={i}
            cx={x(i)}
            cy={TOP - 10}
            r={4}
            className="fill-none stroke-fg-muted"
            strokeWidth={1.5}
          />
        ) : null,
      )}

      {barre && (
        <rect
          x={x(6 - barre.fromString) - 6}
          y={y(barre.fret) - 6}
          width={x(6 - barre.toString) - x(6 - barre.fromString) + 12}
          height={12}
          rx={6}
          className="fill-accent"
        />
      )}

      {/* Fretted notes (a barre's own fret is drawn by the bar) */}
      {chord.frets.map((fret, i) => {
        if (fret === null || fret === 0) return null;
        const string = 6 - i;
        const onBarre =
          barre !== null &&
          fret === barre.fret &&
          string <= barre.fromString &&
          string >= barre.toString;
        const finger = chord.fingers[i];
        return (
          <g key={i}>
            {!onBarre && <circle cx={x(i)} cy={y(fret)} r={6.5} className="fill-accent" />}
            {showFingers && finger && (!onBarre || string === barre.toString) && (
              <text
                x={x(i)}
                y={y(fret) + 3.5}
                textAnchor="middle"
                className="fill-accent-fg text-[10px] font-bold"
              >
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
