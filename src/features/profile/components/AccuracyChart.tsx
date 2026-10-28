import { useState } from 'react';
import { formatDay } from '@/lib/time/localDay';
import { cx } from '@/ui/cx';
import { percent } from '../../learn/format';
import type { DayAccuracy } from '../stats';

const WIDTH = 320;
const LEFT = 30;
const TOP = 8;
const PLOT_HEIGHT = 112;
const AXIS_HEIGHT = 18;
const HEIGHT = TOP + PLOT_HEIGHT + AXIS_HEIGHT;
/** Surface gap between neighbouring columns, and the widest a column may be. */
const GAP = 2;
const MAX_BAR = 24;
const RADIUS = 4;
const TICKS = [0, 0.5, 1];
const PASS = 0.7;

/** A column with a rounded data end and a square base. */
function columnPath(x: number, width: number, height: number): string {
  const base = TOP + PLOT_HEIGHT;
  const top = base - height;
  const r = Math.min(RADIUS, width / 2, height);
  return `M${x} ${base}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + width - r}Q${x + width} ${top} ${x + width} ${top + r}V${base}Z`;
}

/** Centred over its column, but kept inside the chart near either edge. */
function tooltipPosition(leftPercent: number) {
  const shift = leftPercent < 20 ? 0 : leftPercent > 80 ? -100 : -50;
  return { left: `${leftPercent}%`, transform: `translateX(${shift}%)` };
}

const sessionsText = (count: number) => `${count} ${count === 1 ? 'session' : 'sessions'}`;

/**
 * Daily accuracy as columns, with the pass mark for reference. Each column
 * shows its day and value on hover or keyboard focus; the table below holds
 * the same numbers.
 */
export function AccuracyChart({ days }: { days: readonly DayAccuracy[] }) {
  const [active, setActive] = useState<number | null>(null);
  const slot = (WIDTH - LEFT) / days.length;
  const barWidth = Math.min(MAX_BAR, slot - GAP);
  const y = (value: number) => TOP + PLOT_HEIGHT * (1 - value);
  const played = days.filter((day) => day.accuracy !== null);
  const shown = active === null ? undefined : days[active];

  if (played.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Scored sessions appear here: play a lesson check, or practise with listening on.
      </p>
    );
  }
  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full overflow-visible"
          role="group"
          aria-label={`Accuracy per day, ${formatDay(days[0]?.day ?? '')} to ${formatDay(days.at(-1)?.day ?? '')}`}
          onPointerLeave={() => {
            setActive(null);
          }}
        >
          {TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={LEFT}
                x2={WIDTH}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={LEFT - 6}
                y={y(tick) + 3}
                textAnchor="end"
                className="fill-fg-muted text-[9px] tabular-nums"
              >
                {Math.round(tick * 100)}%
              </text>
            </g>
          ))}
          {days.map((day, i) => {
            const x = LEFT + i * slot + (slot - barWidth) / 2;
            const label =
              day.accuracy === null
                ? `${formatDay(day.day)}: no scored sessions`
                : `${formatDay(day.day)}: ${percent(day.accuracy)}, ${sessionsText(day.sessions)}`;
            return (
              <g key={day.day}>
                {day.accuracy !== null && (
                  <path
                    d={columnPath(x, barWidth, Math.max(1, PLOT_HEIGHT * day.accuracy))}
                    className={cx('fill-chart transition-opacity', active === i && 'opacity-75')}
                  />
                )}
                {/* The whole slot is the hit target, not just the painted column. */}
                <rect
                  x={LEFT + i * slot}
                  y={TOP}
                  width={slot}
                  height={PLOT_HEIGHT}
                  className="fill-transparent outline-none focus-visible:stroke-accent-text"
                  strokeWidth={1.5}
                  tabIndex={day.accuracy === null ? undefined : 0}
                  role={day.accuracy === null ? undefined : 'img'}
                  aria-label={day.accuracy === null ? undefined : label}
                  onPointerEnter={() => {
                    setActive(i);
                  }}
                  onFocus={() => {
                    setActive(i);
                  }}
                  onBlur={() => {
                    setActive(null);
                  }}
                />
              </g>
            );
          })}

          {/* The pass mark, over the columns. */}
          <line
            x1={LEFT}
            x2={WIDTH}
            y1={y(PASS)}
            y2={y(PASS)}
            className="pointer-events-none stroke-fg-muted"
            strokeWidth={1}
          />
          <text
            x={LEFT - 6}
            y={y(PASS) + 3}
            textAnchor="end"
            className="fill-fg-muted text-[9px] tabular-nums"
          >
            {percent(PASS)}
          </text>

          <text x={LEFT} y={HEIGHT - 4} className="fill-fg-muted text-[9px]">
            {formatDay(days[0]?.day ?? '')}
          </text>
          <text x={WIDTH} y={HEIGHT - 4} textAnchor="end" className="fill-fg-muted text-[9px]">
            Today
          </text>
        </svg>
        {shown && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-10 rounded-control border border-border bg-surface-raised px-2.5 py-1.5 text-center text-xs whitespace-nowrap shadow-elevated"
            style={tooltipPosition(((LEFT + ((active ?? 0) + 0.5) * slot) / WIDTH) * 100)}
          >
            <span className="block text-sm font-bold">
              {shown.accuracy === null ? 'No sessions' : percent(shown.accuracy)}
            </span>
            <span className="text-fg-muted">
              {formatDay(shown.day)}
              {shown.sessions > 0 && ` · ${sessionsText(shown.sessions)}`}
            </span>
          </div>
        )}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-accent-text">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-fg-muted">
              <th scope="col" className="py-1 font-medium">
                Day
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Accuracy
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Sessions
              </th>
            </tr>
          </thead>
          <tbody>
            {played.map((day) => (
              <tr key={day.day} className="border-t border-border">
                <td className="py-1">{formatDay(day.day)}</td>
                <td className="py-1 text-right tabular-nums">{percent(day.accuracy ?? 0)}</td>
                <td className="py-1 text-right tabular-nums">{day.sessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
