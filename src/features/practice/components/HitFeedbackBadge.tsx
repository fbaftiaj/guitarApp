import { Check, X } from 'lucide-react';
import type { Hit } from '../scoring/scorer';
import type { Timing } from '../scoring/timing';

const LABELS: Record<Timing, string> = {
  perfect: 'Perfect',
  good: 'Good',
  early: 'Early',
  late: 'Late',
  miss: 'Miss',
};

const COLORS: Record<Timing, string> = {
  perfect: 'text-accent-text',
  good: 'text-accent-text',
  early: 'text-warning',
  late: 'text-warning',
  miss: 'text-danger',
};

/**
 * The latest judgement, shown by the "now" line: timing in words, plus ✓ or ✗
 * for the chord or note. Visual only: results are announced in words elsewhere.
 */
export function HitFeedbackBadge({ hit }: { hit: Hit }) {
  const wrong = hit.correct === false && hit.timing !== 'miss';
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1 left-16 flex animate-pop-in items-center gap-1 rounded-full border border-border bg-surface-raised/95 px-2.5 py-0.5 text-sm font-bold shadow-sm"
    >
      <span className={COLORS[hit.timing]}>{LABELS[hit.timing]}</span>
      {hit.correct === true && <Check className="size-4 text-accent-text" />}
      {wrong && (
        <span className="flex items-center text-danger">
          <X aria-hidden className="size-4" />
          <span className="text-xs font-semibold">
            {hit.target.expected.kind === 'chord' ? 'chord' : 'note'}
          </span>
        </span>
      )}
    </div>
  );
}
