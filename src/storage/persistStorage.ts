import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { getDB } from './db';
import { reportStorageFailure } from './storageStatus';

function isStorageValue<T>(value: unknown): value is StorageValue<T> {
  return typeof value === 'object' && value !== null && 'state' in value;
}

/**
 * Zustand `persist` storage backed by the IndexedDB `kv` store. Values are
 * kept as structured clones (no JSON round-trip). The stored `state` is not
 * validated here; each store validates it in its `merge` option.
 *
 * Failures are reported to the storage status and swallowed, so the app keeps
 * working with in-memory state when IndexedDB is unavailable.
 */
export function createIdbPersistStorage<T>(): PersistStorage<T, Promise<void>> {
  return {
    async getItem(name) {
      try {
        const value = await (await getDB()).get('kv', name);
        return isStorageValue<T>(value) ? value : null;
      } catch (error) {
        reportStorageFailure(error);
        return null;
      }
    },
    async setItem(name, value) {
      try {
        await (await getDB()).put('kv', value, name);
      } catch (error) {
        reportStorageFailure(error);
      }
    },
    async removeItem(name) {
      try {
        await (await getDB()).delete('kv', name);
      } catch (error) {
        reportStorageFailure(error);
      }
    },
  };
}
