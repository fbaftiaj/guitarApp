import { openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, DB_VERSION, StorageUnavailableError, closeDB, getDB } from './db';

describe('getDB', () => {
  afterEach(async () => {
    await closeDB();
  });

  it('creates the version 1 schema', async () => {
    const db = await getDB();

    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['kv', 'lessonProgress', 'sessions']);
    expect([...db.transaction('sessions').store.indexNames].sort()).toEqual([
      'byExercise',
      'byStartedAt',
    ]);
  });

  it('shares one connection until it is closed', async () => {
    const first = await getDB();
    expect(await getDB()).toBe(first);

    await closeDB();
    expect(await getDB()).not.toBe(first);
  });

  it('fails with StorageUnavailableError when IndexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);

    await expect(getDB()).rejects.toBeInstanceOf(StorageUnavailableError);
  });

  it('fails with StorageUnavailableError when opening is refused, then retries on the next call', async () => {
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    const error: unknown = await getDB().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StorageUnavailableError);
    expect((error as StorageUnavailableError).cause).toBeInstanceOf(DOMException);

    await expect(getDB()).resolves.toBeDefined();
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('closes its connection so a newer app version in another tab can upgrade', async () => {
    await getDB();

    // Would hang (blocked) if this connection stayed open.
    const newer = await openDB(DB_NAME, DB_VERSION + 1);

    expect(newer.version).toBe(DB_VERSION + 1);
    newer.close();
  });
});
