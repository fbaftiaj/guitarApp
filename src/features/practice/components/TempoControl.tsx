import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { MAX_TEMPO, MIN_TEMPO } from '@/content/exercises';
import { cx } from '@/ui/cx';
import { IconButton } from '@/ui/IconButton';
import { clampTempo } from '../engine/transport';

interface TempoControlProps {
  tempo: number;
  /** The exercise's target tempo. */
  target: number;
  onChange: (tempo: number) => void;
}

const PRESETS = [0.5, 0.75, 1, 1.25] as const;

/** Tempo slider with ±1 BPM buttons and presets relative to the target tempo. */
export function TempoControl({ tempo, target, onChange }: TempoControlProps) {
  const inputId = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium">
          Tempo
        </label>
        <p className="text-sm text-fg-muted">
          <output htmlFor={inputId} className="text-base font-semibold text-fg tabular-nums">
            {tempo} BPM
          </output>{' '}
          · target {target}
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <IconButton
          icon={Minus}
          label="Slower by 1 BPM"
          disabled={tempo <= MIN_TEMPO}
          onClick={() => {
            onChange(tempo - 1);
          }}
          className="disabled:opacity-40"
        />
        <input
          id={inputId}
          type="range"
          min={MIN_TEMPO}
          max={MAX_TEMPO}
          step={1}
          value={tempo}
          aria-valuetext={`${tempo} beats per minute`}
          onChange={(event) => {
            onChange(Number(event.target.value));
          }}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-accent"
        />
        <IconButton
          icon={Plus}
          label="Faster by 1 BPM"
          disabled={tempo >= MAX_TEMPO}
          onClick={() => {
            onChange(tempo + 1);
          }}
          className="disabled:opacity-40"
        />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Tempo presets">
        {PRESETS.map((ratio) => {
          const presetTempo = clampTempo(target * ratio);
          const active = presetTempo === tempo;
          return (
            <button
              key={ratio}
              type="button"
              aria-pressed={active}
              title={`${presetTempo} BPM`}
              onClick={() => {
                onChange(presetTempo);
              }}
              className={cx(
                'min-h-11 rounded-control border text-sm font-semibold tabular-nums transition-colors',
                active
                  ? 'border-accent bg-accent/15 text-fg'
                  : 'border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg',
              )}
            >
              {ratio * 100}%
            </button>
          );
        })}
      </div>
    </div>
  );
}
