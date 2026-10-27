import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { cx } from '@/ui/cx';
import { IN_TUNE_CENTS, type TuningCue } from '../tunerEngine';

/** The scale runs from −50 to +50 cents (literal values in the ARIA attributes below). */
const MAX_CENTS = 50;
/** Needle angle at ±50 cents. */
const SWEEP_DEGREES = 60;
const DEGREES_PER_CENT = SWEEP_DEGREES / MAX_CENTS;
/**
 * Exponential smoothing time constant for the needle: ~90 % of a change is
 * shown within 100 ms, without the jitter of raw readings.
 */
const NEEDLE_TIME_CONSTANT_SECONDS = 0.042;

// Drawing geometry in SVG user units.
const WIDTH = 320;
const HEIGHT = 182;
const PIVOT_X = 160;
const PIVOT_Y = 172;
const RADIUS = 150;

const TICKS = Array.from({ length: 21 }, (_, i) => (i - 10) * 5);

function polar(angleDegrees: number, radius: number): [number, number] {
  const radians = (angleDegrees * Math.PI) / 180;
  return [PIVOT_X + radius * Math.sin(radians), PIVOT_Y - radius * Math.cos(radians)];
}

function arc(fromDegrees: number, toDegrees: number, radius: number): string {
  const [x1, y1] = polar(fromDegrees, radius);
  const [x2, y2] = polar(toDegrees, radius);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
}

function clampCents(cents: number): number {
  return Math.max(-MAX_CENTS, Math.min(MAX_CENTS, cents));
}

const NEEDLE_COLORS: Record<TuningCue, string> = {
  'in-tune': 'bg-accent',
  flat: 'bg-flat',
  sharp: 'bg-sharp',
};

const BADGE_COLORS: Record<TuningCue, string> = {
  'in-tune':
    'border-accent shadow-[0_0_0_6px_color-mix(in_oklab,var(--color-accent)_22%,transparent)]',
  flat: 'border-flat/70',
  sharp: 'border-sharp/70',
};

function describe(cents: number | null, cue: TuningCue | null): string {
  if (cents === null || cue === null) return 'No note detected';
  if (cue === 'in-tune') return 'In tune';
  const amount = Math.abs(Math.round(cents));
  return `${amount} ${amount === 1 ? 'cent' : 'cents'} ${cue}`;
}

interface TunerMeterProps {
  /** Live offset, read every animation frame; null when there is no pitch. */
  centsRef: RefObject<number | null>;
  /** Offset as last published, for assistive tech. */
  cents: number | null;
  cue: TuningCue | null;
  /** True while listening; the needle rests at zero otherwise. */
  active: boolean;
  /** Shown in the round badge at the needle's pivot (the note name). */
  children: ReactNode;
}

/**
 * Arc gauge from −50 to +50 cents with a green ±5 cent zone, a smoothed
 * needle and a round badge at the pivot that holds the note name.
 */
export function TunerMeter({ centsRef, cents, cue, active, children }: TunerMeterProps) {
  const needleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const needle = needleRef.current;
    if (!needle) return;
    if (!active) {
      needle.style.transform = 'rotate(0deg)';
      return;
    }
    let shown = 0;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      const target = clampCents(centsRef.current ?? 0);
      shown += (target - shown) * (1 - Math.exp(-elapsed / NEEDLE_TIME_CONSTANT_SECONDS));
      needle.style.transform = `rotate(${(shown * DEGREES_PER_CENT).toFixed(2)}deg)`;
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, centsRef]);

  const greenZone = IN_TUNE_CENTS * DEGREES_PER_CENT;
  const [flatX, flatY] = polar(-44, RADIUS - 40);
  const [sharpX, sharpY] = polar(44, RADIUS - 40);

  const pivotBottom = `${((HEIGHT - PIVOT_Y) / HEIGHT) * 100}%`;
  return (
    // Bottom padding leaves room for the half of the badge that hangs below the arc.
    <div className="mx-auto w-full max-w-[17rem] pb-12">
      <div
        role="meter"
        aria-label="Tuning offset"
        aria-valuemin={-50}
        aria-valuemax={50}
        aria-valuenow={cents === null ? 0 : Math.round(clampCents(cents))}
        aria-valuetext={describe(cents, cue)}
        className="relative w-full"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden className="absolute inset-0 size-full">
          <path
            d={arc(-greenZone, greenZone, RADIUS - 8)}
            className={cx(
              'fill-none stroke-accent transition-opacity',
              cue === 'in-tune' ? 'opacity-90' : 'opacity-35',
            )}
            strokeWidth={14}
            strokeLinecap="round"
          />
          {TICKS.map((tick) => {
            const major = tick % 25 === 0;
            const [x1, y1] = polar(tick * DEGREES_PER_CENT, RADIUS);
            const [x2, y2] = polar(tick * DEGREES_PER_CENT, RADIUS - (major ? 20 : 11));
            return (
              <line
                key={tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={major ? 'stroke-fg-muted' : 'stroke-border-strong'}
                strokeWidth={major ? 3 : 2}
                strokeLinecap="round"
              />
            );
          })}
          <text x={flatX} y={flatY} textAnchor="middle" className="fill-flat text-[24px] font-bold">
            ♭
          </text>
          <text
            x={sharpX}
            y={sharpY}
            textAnchor="middle"
            className="fill-sharp text-[24px] font-bold"
          >
            ♯
          </text>
        </svg>
        <div
          ref={needleRef}
          className={cx(
            'absolute w-1 origin-bottom rounded-full transition-colors duration-150 will-change-transform',
            cue && active ? NEEDLE_COLORS[cue] : 'bg-fg-subtle',
          )}
          style={{
            left: `calc(${(PIVOT_X / WIDTH) * 100}% - 0.125rem)`,
            bottom: pivotBottom,
            height: `${((RADIUS - 14) / HEIGHT) * 100}%`,
          }}
        />
        <div
          className={cx(
            'absolute left-1/2 flex size-28 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border-4 bg-surface transition-[border-color,box-shadow] duration-200',
            cue && active ? BADGE_COLORS[cue] : 'border-border',
          )}
          style={{ bottom: pivotBottom }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
