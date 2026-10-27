import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDB } from './db';
import { createIdbPersistStorage } from './persistStorage';
import { useStorageStatus } from './storageStatus';

describe('createIdbPersistStorage', () => {
  beforeEach(() => {
    useStorageStatus.setState({ failed: false });
  });

  it('round-trips persisted state', async () => {
    const storage = createIdbPersistStorage<{ count: number }>();

    expect(await storage.getItem('counter')).toBeNull();
    await storage.setItem('counter', { state: { count: 3 }, version: 2 });
    expect(await storage.getItem('counter')).toEqual({ state: { count: 3 }, version: 2 });

    await storage.removeItem('counter');
    expect(await storage.getItem('counter')).toBeNull();
  });

  it('ignores stored values that are not persisted state', async () => {
    await (await getDB()).put('kv', 'not an object', 'counter');

    expect(await createIdbPersistStorage().getItem('counter')).toBeNull();
  });

  it('reports failures instead of throwing when IndexedDB is unavailable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('indexedDB', undefined);
    const storage = createIdbPersistStorage<{ count: number }>();

    await expect(storage.getItem('counter')).resolves.toBeNull();
    await expect(storage.setItem('counter', { state: { count: 1 } })).resolves.toBeUndefined();
    await expect(storage.removeItem('counter')).resolves.toBeUndefined();

    expect(useStorageStatus.getState().failed).toBe(true);
    expect(consoleError).toHaveBeenCalled();
  });
});
