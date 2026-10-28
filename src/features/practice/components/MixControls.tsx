import type { BusLevel, PracticeBus } from '@/audio/synth/practiceSynth';
import { Switch } from '@/ui/Switch';
import type { Mix } from '../practiceStore';

interface MixControlsProps {
  mix: Mix;
  onChange: (bus: PracticeBus, level: Partial<BusLevel>) => void;
}

const BUSES: { bus: PracticeBus; label: string; description: string }[] = [
  { bus: 'metronome', label: 'Metronome', description: 'The count-in always plays.' },
  { bus: 'backing', label: 'Backing track', description: 'Bass and drums.' },
  { bus: 'guide', label: 'Guide playback', description: 'Plays the part for you to follow.' },
];

export function MixControls({ mix, onChange }: MixControlsProps) {
  return (
    <div className="divide-y divide-border/60">
      {BUSES.map(({ bus, label, description }) => {
        const level = mix[bus];
        const percent = Math.round(level.volume * 100);
        return (
          <div key={bus} className="py-2 first:pt-0 last:pb-0">
            <Switch
              label={label}
              description={description}
              checked={level.enabled}
              onChange={(enabled) => {
                onChange(bus, { enabled });
              }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={percent}
              aria-label={`${label} volume`}
              aria-valuetext={`${percent}%`}
              disabled={!level.enabled}
              onChange={(event) => {
                onChange(bus, { volume: Number(event.target.value) / 100 });
              }}
              className="h-11 w-full cursor-pointer accent-accent disabled:cursor-default disabled:opacity-40"
            />
          </div>
        );
      })}
    </div>
  );
}
