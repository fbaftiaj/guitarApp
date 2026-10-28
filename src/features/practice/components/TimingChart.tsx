import { TIMING_WINDOWS } from '../scoring/timing';
import type { SessionSummary } from '../scoring/summary';

const WIDTH = 320;
const HEIGHT = 140;
const PAD = { left: 30, right: 6, top: 8, bottom: 18 };
const RANGE_MS = TIMING_WINDOWS.hit * 1000;

/** Each judged strum or note: how early or late it was over the session, with the scoring bands. */
export function TimingChart({ summary }: { summary: SessionSummary }) {
  const points = summary.timeline;
  const duration = Math.max(1, ...points.map((point) => point.time));
  const x = (time: number) => PAD.left + (time / duration) * (WIDTH - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const y = (ms: number) =>
    PAD.top +
    ((RANGE_MS - Math.max(-RANGE_MS, Math.min(RANGE_MS, ms))) / (2 * RANGE_MS)) * plotHeight;
  const band = (ms: number) => ({ y: y(ms), height: y(-ms) - y(ms) });
  const good = band(TIMING_WINDOWS.good * 1000);
  const perfect = band(TIMING_WINDOWS.perfect * 1000);
  const mean = summary.meanDeviationMs;
  const description =
    mean === null
      ? 'No strums or notes were timed.'
      : `On average ${Math.abs(mean)} ms ${mean >= 0 ? 'behind' : 'ahead of'} the beat.`;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Timing chart. ${description}`}
        className="h-auto w-full"
      >
        <rect
          x={PAD.left}
          y={good.y}
          width={WIDTH - PAD.left - PAD.right}
          height={good.height}
          className="fill-accent/10"
        />
        <rect
          x={PAD.left}
          y={perfect.y}
          width={WIDTH - PAD.left - PAD.right}
          height={perfect.height}
          className="fill-accent/15"
        />
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={y(0)}
          y2={y(0)}
          className="stroke-accent"
          strokeWidth={1}
        />
        {[RANGE_MS, 0, -RANGE_MS].map((ms) => (
          <text
            key={ms}
            x={PAD.left - 4}
            y={y(ms) + 3}
            textAnchor="end"
            className="fill-fg-subtle text-[9px]"
          >
            {ms > 0 ? `+${ms}` : ms}
          </text>
        ))}
        <text x={PAD.left} y={HEIGHT - 4} className="fill-fg-subtle text-[9px]">
          late ↑ · early ↓ (ms)
        </text>
        {points.map((point, i) =>
          point.deviationMs === null ? (
            <text
              key={i}
              x={x(point.time)}
              y={HEIGHT - PAD.bottom + 2}
              textAnchor="middle"
              className="fill-danger text-[9px] font-bold"
            >
              ×
            </text>
          ) : (
            <circle
              key={i}
              cx={x(point.time)}
              cy={y(point.deviationMs)}
              r={3}
              className={point.correct ? 'fill-accent-text' : 'fill-danger'}
            />
          ),
        )}
      </svg>
      <figcaption className="mt-1 text-xs text-fg-muted">
        {description} Dots in the green band were on time; red marks a wrong chord or note, × a
        miss.
      </figcaption>
    </figure>
  );
}
