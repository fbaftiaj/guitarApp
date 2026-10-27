import { ArrowDown, ArrowUp, Check, type LucideIcon } from 'lucide-react';
import { accidentalSymbol, spokenNote } from '@/lib/music/notes';
import { cx } from '@/ui/cx';
import { formatCents } from '../format';
import type { TunerMode, TunerReading, TuningCue } from '../tunerEngine';

const CUES: Record<TuningCue, { label: string; icon: LucideIcon; className: string }> = {
  flat: { label: 'Tune up', icon: ArrowUp, className: 'text-flat' },
  sharp: { label: 'Tune down', icon: ArrowDown, className: 'text-sharp' },
  'in-tune': { label: 'In tune', icon: Check, className: 'text-accent-text' },
};

function hasPitch(reading: TunerReading): boolean {
  return reading.status === 'pitch' && reading.note !== null && reading.cents !== null;
}

/** The note name, sized for the meter's pivot badge. */
export function NoteBadge({ reading }: { reading: TunerReading }) {
  const { note } = reading;
  if (!hasPitch(reading) || !note) {
    return (
      <span aria-hidden className="text-4xl font-bold text-fg-subtle">
        –
      </span>
    );
  }
  return (
    <p className="flex items-start leading-none font-bold tracking-tight">
      <span className="sr-only">{spokenNote(note)}</span>
      <span aria-hidden className="text-6xl">
        {note.letter}
      </span>
      <span aria-hidden className="mt-0.5 ml-0.5 flex flex-col items-start">
        <span className="h-6 text-2xl">{accidentalSymbol(note.accidental)}</span>
        <span className="text-lg text-fg-muted">{note.octave}</span>
      </span>
    </p>
  );
}

interface CueLineProps {
  reading: TunerReading;
  mode: TunerMode;
}

/** How far off the note is, and which way to turn the peg (or a listening hint). */
export function CueLine({ reading, mode }: CueLineProps) {
  const { cents, cue, frequency } = reading;
  if (!hasPitch(reading) || cents === null || !cue) {
    return (
      <div className="flex min-h-16 items-center justify-center text-center font-medium text-fg-muted">
        Listening… {mode === 'chromatic' ? 'play any note' : 'play a string'}
      </div>
    );
  }
  const { label, icon: CueIcon, className } = CUES[cue];
  return (
    <div className="flex min-h-16 flex-col items-center justify-center text-center">
      <p className="text-lg font-semibold text-fg-muted tabular-nums">
        {formatCents(cents)}
        {mode === 'chromatic' && frequency !== null && (
          <span className="ml-2 text-sm font-normal text-fg-subtle">{frequency.toFixed(1)} Hz</span>
        )}
      </p>
      <p className={cx('flex items-center gap-1.5 text-lg font-semibold', className)}>
        <CueIcon aria-hidden className="size-5" strokeWidth={2.5} />
        {label}
      </p>
    </div>
  );
}
