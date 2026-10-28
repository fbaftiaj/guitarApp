/** Calendar days in the player's own time zone, as "YYYY-MM-DD" keys. */

const pad = (value: number) => String(value).padStart(2, '0');

export function localDay(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The day `offset` days after `day` (negative for before). */
export function addDays(day: string, offset: number): string {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  // Noon, so daylight-saving shifts never move the date.
  return localDay(new Date(year, month - 1, date + offset, 12).getTime());
}

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

/** "Oct 28" (in the player's locale) for a "YYYY-MM-DD" day. */
export function formatDay(day: string): string {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  return dayFormat.format(new Date(year, month - 1, date));
}
