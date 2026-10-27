import { create } from 'zustand';

interface StorageStatus {
  /** True once any read or write to IndexedDB has failed this session. */
  failed: boolean;
}

export const useStorageStatus = create<StorageStatus>(() => ({ failed: false }));

export function reportStorageFailure(error: unknown): void {
  console.error('[storage]', error);
  useStorageStatus.setState({ failed: true });
}
