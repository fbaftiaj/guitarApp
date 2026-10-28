import { useEffect } from 'react';
import { useActivityStore } from '@/stores/activityStore';

/** Counts the time `playing` is true towards the day's practice (streak and minutes). */
export function usePracticeTime(playing: boolean): void {
  const addPractice = useActivityStore((state) => state.addPractice);
  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    return () => {
      addPractice((performance.now() - started) / 1000);
    };
  }, [addPractice, playing]);
}
