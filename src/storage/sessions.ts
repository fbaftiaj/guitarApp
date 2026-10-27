import { getDB } from './db';
import { sessionResultSchema, type NewSessionResult, type SessionResult } from './types';

/** Validates and stores a finished session, assigning it an id. */
export async function saveSession(input: NewSessionResult): Promise<SessionResult> {
  const session = sessionResultSchema.parse({ ...input, id: crypto.randomUUID() });
  const db = await getDB();
  await db.add('sessions', session);
  return session;
}

export interface ListSessionsOptions {
  /** Only sessions started at or after this epoch-ms time. */
  since?: number;
  /** Maximum number of sessions to return. */
  limit?: number;
}

/** Sessions, newest first. */
export async function listSessions({
  since = 0,
  limit = Number.POSITIVE_INFINITY,
}: ListSessionsOptions = {}): Promise<SessionResult[]> {
  const db = await getDB();
  const index = db.transaction('sessions').store.index('byStartedAt');
  const sessions: SessionResult[] = [];
  let cursor = await index.openCursor(IDBKeyRange.lowerBound(since), 'prev');
  while (cursor && sessions.length < limit) {
    sessions.push(cursor.value);
    cursor = await cursor.continue();
  }
  return sessions;
}

/** All sessions of one exercise, newest first. */
export async function listSessionsForExercise(exerciseId: string): Promise<SessionResult[]> {
  const db = await getDB();
  const sessions = await db.getAllFromIndex('sessions', 'byExercise', exerciseId);
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}
