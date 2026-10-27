import { Check } from 'lucide-react';
import { memo } from 'react';
import type { TuningString } from '@/content/instruments';
import { accidentalSymbol, noteLabel, spokenNote } from '@/lib/music/notes';
import { cx } from '@/ui/cx';
import { HEADSTOCK_WIDTH as WIDTH, NECK, TOP, headstockLayout } from './headstockLayout';

export type HeadstockStyle = 'acoustic' | 'electric' | 'bass' | 'ukulele';

const STRING_COLORS = [
  'stroke-string-1',
  'stroke-string-2',
  'stroke-string-3',
  'stroke-string-4',
  'stroke-string-5',
  'stroke-string-6',
];

const ORDINALS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
];

function headstockPath(style: HeadstockStyle, nutY: number): string {
  if (style === 'electric' || style === 'bass') {
    return `M 92 ${TOP - 6} L 196 ${TOP - 22} Q 214 ${TOP - 24} 213 ${TOP - 4} L 210 ${nutY - 26} Q 208 ${nutY} 184 ${nutY} L 116 ${nutY} Q 92 ${nutY} 90 ${nutY - 26} Z`;
  }
  return `M 98 ${TOP - 12} Q 150 ${TOP - 30} 202 ${TOP - 12} Q 214 ${TOP - 6} 212 ${TOP + 8} L 210 ${nutY - 26} Q 208 ${nutY} 184 ${nutY} L 116 ${nutY} Q 92 ${nutY} 90 ${nutY - 26} L 88 ${TOP + 8} Q 86 ${TOP - 6} 98 ${TOP - 12} Z`;
}

interface HeadstockProps {
  strings: readonly TuningString[];
  /** Strings per course (2 on a 12-string), for colours and labels. */
  courseSize: 1 | 2;
  style: HeadstockStyle;
  /** String the tuner is measuring (detected or chosen). */
  activeIndex: number | null;
  /** In manual mode the pegs are a single-choice group. */
  selectable: boolean;
  tuned: ReadonlySet<number>;
  onPegPress: (index: number) => void;
}

/** Headstock drawing with one button per tuning peg. */
export const Headstock = memo(function Headstock({
  strings,
  courseSize,
  style,
  activeIndex,
  selectable,
  tuned,
  onPegPress,
}: HeadstockProps) {
  const { height, nutY, pegs, nutX } = headstockLayout(strings.length);
  const courses = strings.length / courseSize;
  const wood = style === 'acoustic' || style === 'ukulele';

  return (
    <div
      className="relative mx-auto w-full max-w-[20rem]"
      style={{ aspectRatio: `${WIDTH} / ${height}` }}
    >
      <svg viewBox={`0 0 ${WIDTH} ${height}`} aria-hidden className="absolute inset-0 size-full">
        <rect x={120} y={nutY} width={60} height={NECK + 2} className="fill-wood-dark" />
        <path
          d={headstockPath(style, nutY)}
          className={wood ? 'fill-wood stroke-wood-dark' : 'fill-ebony stroke-border-strong'}
          strokeWidth={2}
        />
        {pegs.map(({ index, x, y, postX }) => (
          <line
            key={`shaft-${index}`}
            x1={x + (x < WIDTH / 2 ? 18 : -18)}
            y1={y}
            x2={postX}
            y2={y}
            className="stroke-hardware"
            strokeWidth={7}
            strokeLinecap="round"
          />
        ))}
        {strings.map((string, i) => {
          const peg = pegs[i];
          if (!peg) return null;
          const number = courses - (string.course - 1);
          return (
            <polyline
              key={`string-${string.index}`}
              points={`${peg.postX},${peg.y} ${nutX(i)},${nutY} ${nutX(i)},${height}`}
              className={cx('fill-none', STRING_COLORS[(number - 1) % 6])}
              strokeWidth={1.2 + (number - 1) * 0.25}
            />
          );
        })}
        {pegs.map(({ index, y, postX }) => (
          <circle key={`post-${index}`} cx={postX} cy={y} r={6} className="fill-hardware" />
        ))}
        <rect x={118} y={nutY - 4} width={64} height={8} rx={2} className="fill-nut" />
      </svg>

      <div role="group" aria-label="Strings">
        {strings.map((string) => {
          const peg = pegs[string.index];
          if (!peg) return null;
          const isActive = activeIndex === string.index;
          const isTuned = tuned.has(string.index);
          const position =
            courseSize > 1
              ? `${ORDINALS[courses - string.course] ?? ''} course, string ${(string.index % courseSize) + 1} of ${courseSize}`
              : `${ORDINALS[courses - string.course] ?? ''} string`;
          // Starts with the visible text ("E♭2") so voice control can target it (WCAG 2.5.3).
          const visible = noteLabel(string.note);
          const name = string.note.accidental ? `${visible} (${spokenNote(string.note)})` : visible;
          const label = `${name}, ${position}${isTuned ? ', in tune' : ''}`;
          return (
            <button
              key={string.index}
              type="button"
              aria-label={label}
              aria-pressed={selectable ? isActive : undefined}
              onClick={() => {
                onPegPress(string.index);
              }}
              className={cx(
                'absolute flex size-12 items-center justify-center rounded-full border-2 text-base font-bold shadow-sm transition-[background-color,border-color,scale] duration-150 active:scale-95',
                isActive
                  ? 'border-accent-text bg-accent text-accent-fg'
                  : 'border-border-strong bg-surface-raised text-fg hover:border-fg-subtle',
              )}
              style={{
                left: `calc(${(peg.x / WIDTH) * 100}% - 1.5rem)`,
                top: `calc(${(peg.y / height) * 100}% - 1.5rem)`,
              }}
            >
              <span aria-hidden>
                {string.note.letter}
                {accidentalSymbol(string.note.accidental)}
                <sub className="ml-px text-[0.65rem] font-semibold opacity-75">
                  {string.note.octave}
                </sub>
              </span>
              {isTuned && (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 flex size-5 animate-pop-in items-center justify-center rounded-full bg-accent text-accent-fg ring-2 ring-surface"
                >
                  <Check className="size-3.5" strokeWidth={3.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
