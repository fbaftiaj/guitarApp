import type { SessionSummary } from '../scoring/summary';

const COUNTS = [
  ['perfect', 'Perfect'],
  ['good', 'Good'],
  ['early', 'Early'],
  ['late', 'Late'],
  ['miss', 'Miss'],
] as const;

/** How many strums or notes were Perfect, Good, Early, Late or missed. */
export function HitCounts({ summary }: { summary: SessionSummary }) {
  return (
    <>
      <dl className="grid grid-cols-5 gap-1 text-center text-xs">
        {COUNTS.map(([key, label]) => (
          <div key={key} className="rounded-control bg-surface-raised py-2">
            <dt className="text-fg-muted">{label}</dt>
            <dd className="text-base font-bold tabular-nums">{summary.counts[key]}</dd>
          </div>
        ))}
      </dl>
      {summary.wrong > 0 && (
        <p className="text-center text-sm text-fg-muted">
          {summary.wrong} played on time with the wrong{' '}
          {summary.wrong === 1 ? 'chord or note' : 'chords or notes'}
        </p>
      )}
    </>
  );
}
