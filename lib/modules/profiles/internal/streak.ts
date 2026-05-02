// Pure streak math. Given a chronologically ascending series of net P&L per
// closed session, return the count of consecutive sessions ending in profit
// (net > 0) walking backward from the most recent. Returns 0 if the most
// recent session was not a win, or if the series is empty.
export function computeCurrentStreak(seriesAsc: readonly number[]): number {
  if (seriesAsc.length === 0) return 0;
  const last = seriesAsc[seriesAsc.length - 1];
  if (last === undefined) return 0;
  if (last <= 0) return 0;
  let count = 0;
  for (let i = seriesAsc.length - 1; i >= 0; i--) {
    const v = seriesAsc[i];
    if (v === undefined) break;
    if (v > 0) count++;
    else break;
  }
  return count;
}
