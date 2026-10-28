import { cx } from '@/ui/cx';

interface PracticeStatusProps {
  bar: number;
  totalBars: number;
  labels: readonly string[];
  /** Highlighted slot of the beat counter, or null. */
  slot: number | null;
  tempo: number;
  /** Shown when looping. */
  pass: number | null;
  /** Running accuracy (0–1) while listening, or null. */
  accuracy?: number | null;
}

/** Bar counter, loop pass and tempo, then the "1 & 2 & 3 & 4 &" beat counter. */
export function PracticeStatus({
  bar,
  totalBars,
  labels,
  slot,
  tempo,
  pass,
  accuracy = null,
}: PracticeStatusProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold tabular-nums">
          Bar {bar + 1}
          <span className="text-fg-muted"> / {totalBars}</span>
        </p>
        <p className="text-right text-fg-muted tabular-nums">
          {accuracy !== null && (
            <span>
              <span className="font-semibold text-fg">{Math.round(accuracy * 100)}%</span> ·{' '}
            </span>
          )}
          {pass !== null && <span>Loop {pass} · </span>}
          <span className="font-semibold text-fg">{tempo}</span> BPM
        </p>
      </div>
      <ol aria-label="Beat" className="flex justify-center gap-2 font-mono text-lg">
        {labels.map((label, i) => (
          <li
            key={i}
            aria-current={i === slot ? 'true' : undefined}
            className={cx(
              'w-5 text-center transition-colors duration-75',
              i === slot
                ? 'font-bold text-accent-text'
                : label === '&'
                  ? 'text-fg-subtle'
                  : 'text-fg-muted',
            )}
          >
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
