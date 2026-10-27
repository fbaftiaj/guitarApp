import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LessonProgress, SessionResult } from './types';

export const DB_NAME = 'fretpath';
export const DB_VERSION = 1;

export interface FretPathDB extends DBSchema {
  /** Small documents keyed by name, e.g. persisted Zustand stores. */
  kv: { key: string; value: unknown };
  sessions: {
    key: string;
    value: SessionResult;
    indexes: { byStartedAt: number; byExercise: string };
  };
  lessonProgress: { key: string; value: LessonProgress };
}

export type FretPathDatabase = IDBPDatabase<FretPathDB>;

/** IndexedDB could not be opened: private browsing, blocked site data, or no quota. */
export class StorageUnavailableError extends Error {
  override readonly name = 'StorageUnavailableError';

  constructor(options?: ErrorOptions) {
    super('Local storage (IndexedDB) is unavailable', options);
  }
}

let connection: Promise<FretPathDatabase> | null = null;

/** Returns the shared database connection, opening (and migrating) it on first use. */
export function getDB(): Promise<FretPathDatabase> {
  if (!connection) {
    const opening = open();
    connection = opening;
    // Forget a failed attempt so the next call retries. This must not live in
    // open(): its body runs synchronously up to the first await, so a reset
    // there could run before this assignment and be overwritten by it.
    opening.catch(() => {
      if (connection === opening) connection = null;
    });
  }
  return connection;
}

/** Closes the shared connection; the next `getDB()` reopens it. */
export async function closeDB(): Promise<void> {
  const pending = connection;
  connection = null;
  if (!pending) return;
  try {
    (await pending).close();
  } catch {
    // The open failed, so there is nothing to close.
  }
}

async function open(): Promise<FretPathDatabase> {
  if (typeof indexedDB === 'undefined') throw new StorageUnavailableError();
  try {
    return await openDB<FretPathDB>(DB_NAME, DB_VERSION, {
      upgrade: migrate,
      // A newer version of the app opened in another tab: step aside so its
      // upgrade is not blocked by this connection.
      blocking: () => void closeDB(),
      // The browser closed the connection abnormally (e.g. storage cleared).
      terminated: () => {
        connection = null;
      },
    });
  } catch (cause) {
    throw new StorageUnavailableError({ cause });
  }
}

/**
 * Schema migrations. Each step upgrades from the previous version; never edit
 * a step that has shipped, add a new `if (oldVersion < N)` block instead.
 */
function migrate(db: IDBPDatabase<FretPathDB>, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore('kv');
    const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
    sessions.createIndex('byStartedAt', 'startedAt');
    sessions.createIndex('byExercise', 'exerciseId');
    db.createObjectStore('lessonProgress', { keyPath: 'lessonId' });
  }
}
