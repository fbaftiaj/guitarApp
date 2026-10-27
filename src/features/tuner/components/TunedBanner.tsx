import { CircleCheck, RotateCcw } from 'lucide-react';
import { Button } from '@/ui/Button';
import { ButtonLink } from '@/ui/ButtonLink';

interface TunedBannerProps {
  instrumentName: string;
  stringCount: number;
  onTuneAgain: () => void;
}

/** Celebrates a fully tuned instrument and points to what is next. */
export function TunedBanner({ instrumentName, stringCount, onTuneAgain }: TunedBannerProps) {
  return (
    <div
      role="status"
      className="animate-rise-in rounded-card border border-accent/40 bg-accent/10 p-5 text-center"
    >
      <CircleCheck aria-hidden className="mx-auto size-10 animate-pop-in text-accent-text" />
      <p className="mt-2 text-xl font-bold">{instrumentName} tuned!</p>
      <p className="mt-1 text-sm text-fg-muted">All {stringCount} strings are in tune.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <ButtonLink to="/learn">Start learning</ButtonLink>
        <Button variant="secondary" icon={RotateCcw} onClick={onTuneAgain}>
          Tune again
        </Button>
      </div>
    </div>
  );
}
