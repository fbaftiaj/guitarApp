import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { StarRating } from '@/ui/StarRating';
import type { SessionSummary } from '../scoring/summary';
import { HitCounts } from './HitCounts';
import { TimingChart } from './TimingChart';

interface ResultsSheetProps {
  summary: SessionSummary | null;
  onClose: () => void;
  onPlayAgain: () => void;
  /** Sets the suggested tempo and plays again. */
  onTryTempo: (tempo: number) => void;
}

export function ResultsSheet({ summary, onClose, onPlayAgain, onTryTempo }: ResultsSheetProps) {
  return (
    <Sheet open={summary !== null} onClose={onClose} title="Results">
      {summary && (
        <div className="space-y-5">
          <div className="text-center">
            <StarRating stars={summary.stars} size="lg" className="justify-center gap-1" />
            <p className="mt-2 text-4xl font-bold tabular-nums">
              {Math.round(summary.accuracy * 100)}%
            </p>
            <p className="text-sm text-fg-muted">
              accuracy over {summary.total} {summary.total === 1 ? 'target' : 'targets'}
            </p>
          </div>

          <HitCounts summary={summary} />

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
