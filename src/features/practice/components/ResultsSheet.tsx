import { Star } from 'lucide-react';
import { Button } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { Sheet } from '@/ui/Sheet';
import type { SessionSummary } from '../scoring/summary';
import { TimingChart } from './TimingChart';

interface ResultsSheetProps {
  summary: SessionSummary | null;
  onClose: () => void;
  onPlayAgain: () => void;
  /** Sets the suggested tempo and plays again. */
  onTryTempo: (tempo: number) => void;
}

const COUNTS = [
  ['perfect', 'Perfect'],
  ['good', 'Good'],
  ['early', 'Early'],
  ['late', 'Late'],
  ['miss', 'Miss'],
] as const;

export function ResultsSheet({ summary, onClose, onPlayAgain, onTryTempo }: ResultsSheetProps) {
  return (
    <Sheet open={summary !== null} onClose={onClose} title="Results">
      {summary && (
        <div className="space-y-5">
          <div className="text-center">
            <p
              className="flex justify-center gap-1"
              role="img"
              aria-label={`${summary.stars} of 3 stars`}
            >
              {[1, 2, 3].map((star) => (
                <Star
                  key={star}
                  aria-hidden
                  className={cx(
                    'size-8',
                    star <= summary.stars ? 'fill-warning text-warning' : 'text-border-strong',
                  )}
                />
              ))}
            </p>
            <p className="mt-2 text-4xl font-bold tabular-nums">
              {Math.round(summary.accuracy * 100)}%
            </p>
            <p className="text-sm text-fg-muted">
              accuracy over {summary.total} {summary.total === 1 ? 'target' : 'targets'}
            </p>
          </div>

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

          {summary.timeline.length > 0 && <TimingChart summary={summary} />}

          {summary.mostMissed.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">Missed most</h3>
              <ul className="mt-1 flex flex-wrap gap-2">
                {summary.mostMissed.map(({ label, count }) => (
                  <li key={label} className="rounded-full border border-border px-3 py-1 text-sm">
                    <span className="font-semibold">{label}</span>
                    <span className="text-fg-muted"> × {count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-center text-lg font-semibold">{summary.suggestion.text}</p>
          <div className="grid gap-2">
            {summary.suggestion.tempo !== null && summary.suggestion.kind !== 'again' ? (
              <Button
                size="lg"
                onClick={() => {
                  if (summary.suggestion.tempo !== null) onTryTempo(summary.suggestion.tempo);
                }}
              >
                Play at {summary.suggestion.tempo} BPM
              </Button>
            ) : (
              <Button size="lg" onClick={onPlayAgain}>
                Play again
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
