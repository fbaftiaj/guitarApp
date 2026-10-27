/** Short vibration feedback where supported (Android); a no-op elsewhere (iOS). */
export function vibrate(pattern: number | readonly number[]): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate([...[pattern].flat()]);
}
