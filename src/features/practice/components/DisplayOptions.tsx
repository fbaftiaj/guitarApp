import { Switch } from '@/ui/Switch';
import type { LabelKey } from '../practiceStore';

interface DisplayOptionsProps {
  labels: Record<LabelKey, boolean>;
  fretboard: boolean;
  onLabelChange: (label: LabelKey, shown: boolean) => void;
  onFretboardChange: (shown: boolean) => void;
}

const LABELS: { key: LabelKey; label: string }[] = [
  { key: 'chordNames', label: 'Chord names' },
  { key: 'fingers', label: 'Finger numbers' },
  { key: 'noteNames', label: 'Note names' },
];

export function DisplayOptions({
  labels,
  fretboard,
  onLabelChange,
  onFretboardChange,
}: DisplayOptionsProps) {
  return (
    <div>
      {LABELS.map(({ key, label }) => (
        <Switch
          key={key}
          label={label}
          checked={labels[key]}
          onChange={(shown) => {
            onLabelChange(key, shown);
          }}
        />
      ))}
      <Switch
        label="Fretboard view"
        description="Shows the current chord or note on the neck."
        checked={fretboard}
        onChange={onFretboardChange}
      />
    </div>
  );
}
