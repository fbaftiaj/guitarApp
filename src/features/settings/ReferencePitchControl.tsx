import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { A4_RANGE_HZ, DEFAULT_A4_HZ } from '@/lib/music/notes';
import { useSettingsStore } from '@/stores/settingsStore';
import { Button } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';

/** Slider plus ± buttons for the A4 reference pitch (432–446 Hz). */
export function ReferencePitchControl() {
  const referencePitch = useSettingsStore((state) => state.referencePitch);
  const setReferencePitch = useSettingsStore((state) => state.setReferencePitch);
  const inputId = useId();
  const hintId = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-medium">
          Reference pitch (A4)
        </label>
        <output htmlFor={inputId} className="font-semibold tabular-nums">
          {referencePitch} Hz
        </output>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <IconButton
          icon={Minus}
          label="Lower the reference pitch by 1 Hz"
          disabled={referencePitch <= A4_RANGE_HZ.min}
          onClick={() => {
            setReferencePitch(referencePitch - 1);
          }}
          className="disabled:opacity-40"
        />
        <input
          id={inputId}
          type="range"
          min={A4_RANGE_HZ.min}
          max={A4_RANGE_HZ.max}
          step={1}
          value={referencePitch}
          aria-describedby={hintId}
          aria-valuetext={`${referencePitch} hertz`}
          onChange={(event) => {
            setReferencePitch(Number(event.target.value));
          }}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-accent"
        />
        <IconButton
          icon={Plus}
          label="Raise the reference pitch by 1 Hz"
          disabled={referencePitch >= A4_RANGE_HZ.max}
          onClick={() => {
            setReferencePitch(referencePitch + 1);
          }}
          className="disabled:opacity-40"
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p id={hintId} className="text-xs text-fg-muted">
          Standard concert pitch is {DEFAULT_A4_HZ} Hz. Change it to match a piano or a band.
        </p>
        {referencePitch !== DEFAULT_A4_HZ && (
          <Button
            variant="ghost"
            className="shrink-0"
            onClick={() => {
              setReferencePitch(DEFAULT_A4_HZ);
            }}
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
