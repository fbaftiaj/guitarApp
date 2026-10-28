import type { Chord } from '@/content/chords';
import { cx } from '@/ui/cx';

interface BigChordDiagramProps {
  chord: Chord;
  /** The string to play now (1 = high e … 6 = low E), highlighted. */
  activeString?: number | null;
  /** Strings already played right, ticked. */
  doneStrings?: ReadonlySet<number>;
  showFingers?: boolean;
  size?: 'lg' | 'md' | 'sm';
}

const STRING_GAP = 40;
const FRET_GAP = 52;
const FRETS = 4;
const LEFT = 30;
const TOP = 46;
const WIDTH = LEFT * 2 + STRING_GAP * 5;
const HEIGHT = TOP + FRET_GAP * FRETS + 14;

function baseFret(frets: readonly (number | null)[]): number {
  const fretted = frets.filter((fret): fret is number => fret !== null && fret > 0);
  const highest = Math.max(0, ...fretted);
  return highest <= FRETS ? 1 : Math.min(...fretted);
}

function describe(chord: Chord, showFingers: boolean, activeString: number | null): string {
  const strings = chord.frets.map((fret, i) => {
    const string = 6 - i;
    if (fret === null) return `string ${string} not played`;
    if (fret === 0) return `string ${string} open`;
    const finger = chord.fingers[i];
    return `string ${string} fret ${fret}${showFingers && finger ? ` finger ${finger}` : ''}`;
  });
  const now = activeString ? `. Now: string ${activeString}` : '';
  return `${chord.name} chord: ${strings.join(', ')}${now}`;
}

const SIZES = { lg: 'max-w-64', md: 'max-w-44', sm: 'max-w-28 opacity-70' } as const;

/**
 * A large chord box for the trainer and the player: strings run down from the nut (low E
 * on the left), dots show where each finger goes, the string to play now is
 * highlighted and the strings already played right are ticked.
 */
export function BigChordDiagram({
  chord,
  activeString = null,
  doneStrings,
  showFingers = true,
  size = 'lg',
}: BigChordDiagramProps) {
  const base = baseFret(chord.frets);
  const x = (stringIndex: number) => LEFT + stringIndex * STRING_GAP;
  const y = (fret: number) => TOP + (fret - base + 0.5) * FRET_GAP;
  const marker = TOP - 20;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={describe(chord, showFingers, activeString)}
      className={cx('h-auto w-full', SIZES[size])}
    >
      {activeString !== null && (
        <rect
          x={x(6 - activeString) - 15}
          y={TOP}
          width={30}
          height={FRET_GAP * FRETS}
          rx={15}
          className="fill-accent/15 motion-safe:animate-pulse"
        />
      )}
      {Array.from({ length: FRETS + 1 }, (_, i) => (
        <line
          key={i}
          x1={x(0)}
          x2={x(5)}
          y1={TOP + i * FRET_GAP}
          y2={TOP + i * FRET_GAP}
          className="stroke-border-strong"
          strokeWidth={i === 0 && base === 1 ? 8 : 2.5}
          strokeLinecap="round"
        />
      ))}
      {base > 1 && (
        <text
          x={WIDTH - 4}
          y={y(base) + 6}
          textAnchor="end"
          className="fill-fg-muted text-[16px] font-semibold"
        >
          {base}fr
        </text>
      )}
      {chord.frets.map((fret, i) => {
        const string = 6 - i;
        const active = string === activeString;
        return (
          <line
            key={string}
            x1={x(i)}
            x2={x(i)}
            y1={TOP}
            y2={TOP + FRETS * FRET_GAP}
            className={cx(
              active
                ? 'stroke-accent'
                : fret === null
                  ? 'stroke-border-strong'
                  : 'stroke-fg-subtle',
            )}
            strokeWidth={active ? 5 : 2.5 + (5 - i) * 0.35}
          />
        );
      })}

      {chord.frets.map((fret, i) => {
        const string = 6 - i;
        const done = doneStrings?.has(string) ?? false;
        if (fret === null) {
          return (
            <text
              key={string}
              x={x(i)}
              y={marker + 7}
              textAnchor="middle"
              className="fill-fg-muted text-[20px] font-semibold"
            >
              ×
            </text>
          );
        }
        if (done) {
          return (
            <g key={string}>
              <circle cx={x(i)} cy={marker} r={11} className="fill-accent" />
              <path
                d={`M${x(i) - 5} ${marker} l3.5 4 l6.5 -8`}
                className="fill-none stroke-accent-fg"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        }
        return fret === 0 ? (
          <circle
            key={string}
            cx={x(i)}
            cy={marker}
            r={9}
            className={cx(
              'fill-none',
              string === activeString ? 'stroke-accent' : 'stroke-fg-muted',
            )}
            strokeWidth={3}
          />
        ) : null;
      })}

      {chord.frets.map((fret, i) => {
        if (fret === null || fret === 0) return null;
        const string = 6 - i;
        const finger = chord.fingers[i];
        const active = string === activeString;
        return (
          <g key={string}>
            <circle
              cx={x(i)}
              cy={y(fret)}
              r={16}
              className={cx(active ? 'fill-accent' : 'fill-fg')}
            />
            {showFingers && finger && (
              <text
                x={x(i)}
                y={y(fret) + 6.5}
                textAnchor="middle"
                className={cx('text-[19px] font-bold', active ? 'fill-accent-fg' : 'fill-bg')}
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
