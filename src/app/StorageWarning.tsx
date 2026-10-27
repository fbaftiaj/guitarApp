import { HardDrive } from 'lucide-react';
import { useState } from 'react';
import { useStorageStatus } from '@/storage/storageStatus';
import { Notice } from './Notice';

/** Warns once per session when progress cannot be saved on this device. */
export function StorageWarning() {
  const failed = useStorageStatus((state) => state.failed);
  const [dismissed, setDismissed] = useState(false);

  if (!failed || dismissed) return null;

  return (
    <Notice
      icon={HardDrive}
      tone="warning"
      role="alert"
      onDismiss={() => {
        setDismissed(true);
      }}
    >
      <p className="font-semibold">Progress can’t be saved right now</p>
      <p className="mt-1 text-fg-muted">
        Private browsing or full storage may be blocking it. You can keep playing, but progress will
        be lost when you close the app.
      </p>
    </Notice>
  );
}
