import { dayKey } from "./day-boundary";

/**
 * The counter increments once per calendar day, honouring the 3am cutoff via
 * `dayKey`. A second save on the same day, or on the piece's last-practised
 * day, does not double-increment.
 */
export function nextPracticeDaysSinceSpan(
	practiceDaysSinceSpan: number | null | undefined,
	lastPracticed: Date | null | undefined,
	now: Date,
): number {
	const current = practiceDaysSinceSpan ?? 0;
	if (lastPracticed != null && dayKey(lastPracticed) === dayKey(now)) {
		return current;
	}
	return current + 1;
}

/** A span save resets the counter and starts the staleness clock over. */
export function resetSpanCadence(now: Date): {
	practiceDaysSinceSpan: number;
	lastSpanPracticedAt: Date;
} {
	return { practiceDaysSinceSpan: 0, lastSpanPracticedAt: now };
}
