import { useEffect, useState } from 'react';
import { listSessions } from '@/storage/sessions';
import type { SessionResult } from '@/storage/types';

/** Enough history for the meters and the chart without reading years of sessions. */
const RECENT_SESSIONS = 500;

export type RecentSessions =
  | { status: 'loading' }
  | { status: 'ready'; sessions: readonly SessionResult[] }
  | { status: 'error' };

/** The latest scored sessions, newest first. */
export function useRecentSessions(): RecentSessions {
  const [state, setState] = useState<RecentSessions>({ status: 'loading' });
  useEffect(() => {
    let current = true;
    listSessions({ limit: RECENT_SESSIONS }).then(
      (sessions) => {
        if (current) setState({ status: 'ready', sessions });
      },
      (cause: unknown) => {
        console.error('[profile] could not load sessions', cause);
        if (current) setState({ status: 'error' });
      },
    );
    return () => {
      current = false;
    };
  }, []);
  return state;
}
