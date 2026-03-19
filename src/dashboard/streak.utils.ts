/**
 * Computes the current streak starting from referenceDate (or yesterday).
 * dates must be sorted descending.
 */
export function computeStreak(dates: string[], referenceDate: string): number {
  if (dates.length === 0) return 0;

  const yesterday = new Date(new Date(referenceDate).getTime() - 86_400_000)
    .toISOString()
    .split('T')[0];

  if (dates[0] !== referenceDate && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]).getTime();
    const curr = new Date(dates[i]).getTime();
    if (Math.round((prev - curr) / 86_400_000) === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Computes the best (all-time) streak from a list of dates.
 * dates must be sorted descending.
 */
export function computeBestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]).getTime();
    const curr = new Date(dates[i]).getTime();
    if (Math.round((prev - curr) / 86_400_000) === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}
