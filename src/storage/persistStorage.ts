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

interface SafeParser<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

/**
 * `merge` option for persisted stores: stored data is untrusted (older app
 * versions, manual edits), so it is validated with `schema` before it
 * replaces the defaults. Invalid data leaves the current state untouched.
 */
export function mergeValidated<T extends object>(schema: SafeParser<T>) {
  return <S extends T>(persisted: unknown, current: S): S => {
    const parsed = schema.safeParse(persisted);
    return parsed.success ? { ...current, ...parsed.data } : current;
  };
}

interface HydrationApi {
  hasHydrated: () => boolean;
  onFinishHydration: (listener: () => void) => () => void;
}

/**
 * Resolves once a persisted store has loaded, or after `timeoutMs` so a hung
 * IndexedDB open (seen on some WebKit builds) never blocks the UI; the store
 * still updates if loading finishes later.
 */
export function whenHydrated(api: HydrationApi, timeoutMs = 1500): Promise<void> {
  if (api.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    const unsubscribe = api.onFinishHydration(finish);
  });
}
