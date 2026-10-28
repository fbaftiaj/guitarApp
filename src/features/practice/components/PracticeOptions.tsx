import { SegmentedControl } from '@/ui/SegmentedControl';
import { Switch } from '@/ui/Switch';
import { SPEED_UP_STEPS, type ExercisePrefs } from '../practiceStore';

interface PracticeOptionsProps {
  prefs: ExercisePrefs;
  totalBars: number;
  /** 0-based bar being played, where a new loop starts. */
  currentBar: number;
  targetTempo: number;
  onChange: (patch: Partial<ExercisePrefs>) => void;
}

const STEP_OPTIONS = SPEED_UP_STEPS.map((step) => ({ value: String(step), label: `+${step}` }));

/** Loop, auto speed-up and wait mode. Speed-up and wait mode exclude each other. */
export function PracticeOptions({
  prefs,
  totalBars,
  currentBar,
  targetTempo,
  onChange,
}: PracticeOptionsProps) {
  const bars = Array.from({ length: totalBars }, (_, i) => i + 1);
  const selectClasses =
    'min-h-11 rounded-control border border-border bg-surface px-3 text-sm font-medium tabular-nums';

  return (
    <div className="divide-y divide-border/60">
      <div className="pb-2">
        <Switch
          label="Loop"
          description={prefs.loop ? undefined : 'Repeat a few bars until they feel easy.'}
          checked={prefs.loop !== null}
          onChange={(on) => {
            const startBar = Math.min(currentBar + 1, totalBars);
            onChange({
              loop: on ? { startBar, endBar: Math.min(startBar + 1, totalBars) } : null,
            });
          }}
        />
        {prefs.loop && (
          <div className="flex items-center gap-2 pb-2 text-sm">
            <span className="text-fg-muted">Bars</span>
            <select
              aria-label="Loop from bar"
              value={prefs.loop.startBar}
              onChange={(event) => {
                const startBar = Number(event.target.value);
                const endBar = Math.max(startBar, prefs.loop?.endBar ?? startBar);
                onChange({ loop: { startBar, endBar } });
              }}
              className={selectClasses}
            >
              {bars.map((bar) => (
                <option key={bar} value={bar}>
                  {bar}
                </option>
              ))}
            </select>
            <span className="text-fg-muted">to</span>
            <select
              aria-label="Loop to bar"
              value={prefs.loop.endBar}
              onChange={(event) => {
                const endBar = Number(event.target.value);
                const startBar = Math.min(endBar, prefs.loop?.startBar ?? endBar);
                onChange({ loop: { startBar, endBar } });
              }}
              className={selectClasses}
            >
              {bars.map((bar) => (
                <option key={bar} value={bar}>
                  {bar}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="py-2">
        <Switch
          label="Auto speed-up"
          description={`Adds ${prefs.speedUpStep} BPM after each loop, up to ${targetTempo} BPM.`}
          checked={prefs.speedUp}
          onChange={(speedUp) => {
            onChange(speedUp ? { speedUp, waitMode: false } : { speedUp });
          }}
        />
        {prefs.speedUp && (
          <div className="pb-2">
            <SegmentedControl
              legend="Speed-up step"
              hideLegend
              name="speed-up-step"
              options={STEP_OPTIONS}
              value={String(prefs.speedUpStep)}
              onChange={(value) => {
                onChange({ speedUpStep: Number(value) });
              }}
            />
          </div>
        )}
      </div>

      <div className="pt-2">
        <Switch
          label="Wait mode"
          description="Stops at each chord or note until you play it, then tap Next."
          checked={prefs.waitMode}
          onChange={(waitMode) => {
            onChange(waitMode ? { waitMode, speedUp: false } : { waitMode });
          }}
        />
      </div>
    </div>
  );
}
