import { ReferencePitchControl } from '@/features/settings/ReferencePitchControl';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';

interface TunerSettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function TunerSettingsSheet({ open, onClose }: TunerSettingsSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title="Tuner settings">
      <div className="space-y-6">
        <ReferencePitchControl />
        <Button fullWidth size="lg" onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  );
}
