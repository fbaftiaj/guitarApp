import { useEffect, useState } from 'react';
import { localDay } from '@/lib/time/localDay';

const MINUTE_MS = 60_000;

/** Today's local "YYYY-MM-DD", updated when the date changes while the screen is open. */
export function useToday(): string {
  const [today, setToday] = useState(() => localDay(Date.now()));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday(localDay(Date.now()));
    }, MINUTE_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return today;
}
