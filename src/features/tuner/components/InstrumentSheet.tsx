import { Guitar, Zap } from 'lucide-react';
import {
  INSTRUMENTS,
  instrumentLabel,
  resolveSelection,
  type BodyStyle,
  type Tuning,
} from '@/content/instruments';
import { noteLabel } from '@/lib/music/notes';
import { Button } from '@/ui/Button';
import { ChoiceList } from '@/ui/ChoiceList';
import { SegmentedControl, type SegmentedOption } from '@/ui/SegmentedControl';
import { Sheet } from '@/ui/Sheet';
import { useTunerStore } from '../tunerStore';

const BODY_STYLE_OPTIONS: readonly SegmentedOption<BodyStyle>[] = [
  { value: 'acoustic', label: 'Acoustic', icon: Guitar },
  { value: 'electric', label: 'Electric', icon: Zap },
];

const INSTRUMENT_CHOICES = INSTRUMENTS.map((instrument) => ({
  value: instrument.id,
  label: instrumentLabel(instrument),
}));

function tuningNotes(tuning: Tuning): string {
  return tuning.strings.map((string) => noteLabel(string.note)).join(' ');
}

interface InstrumentSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Picks the instrument, guitar type and tuning. Changes apply (and are saved) at once. */
export function InstrumentSheet({ open, onClose }: InstrumentSheetProps) {
  const instrumentId = useTunerStore((state) => state.instrumentId);
  const tuningByInstrument = useTunerStore((state) => state.tuningByInstrument);
  const bodyStyle = useTunerStore((state) => state.bodyStyle);
  const selectInstrument = useTunerStore((state) => state.selectInstrument);
  const selectTuning = useTunerStore((state) => state.selectTuning);
  const setBodyStyle = useTunerStore((state) => state.setBodyStyle);
  const { instrument, tuning } = resolveSelection(instrumentId, tuningByInstrument[instrumentId]);

  return (
    <Sheet open={open} onClose={onClose} title="Instrument and tuning">
      <div className="space-y-6">
        <ChoiceList
          legend="Instrument"
          name="tuner-instrument"
          choices={INSTRUMENT_CHOICES}
          value={instrument.id}
          onChange={selectInstrument}
        />
        {instrument.bodyStyles.length > 0 && (
          <SegmentedControl
            legend="Guitar type"
            name="tuner-body-style"
            options={BODY_STYLE_OPTIONS}
            value={bodyStyle}
            onChange={setBodyStyle}
          />
        )}
        <ChoiceList
          legend="Tuning"
          name="tuner-tuning"
          choices={instrument.tunings.map((candidate) => ({
            value: candidate.id,
            label: candidate.name,
            description: tuningNotes(candidate),
          }))}
          value={tuning.id}
          onChange={selectTuning}
        />
        <Button fullWidth size="lg" onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  );
}
