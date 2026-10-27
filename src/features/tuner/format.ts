/** "−12 ¢", "+3 ¢", "0 ¢" (typographic minus). */
export function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  if (rounded === 0) return '0 ¢';
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded)} ¢`;
}
