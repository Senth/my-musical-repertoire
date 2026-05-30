export const DAY_CUTOFF_HOUR = 3;

export function dayStartCutoff(now: Date): Date {
	const cutoff = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
		DAY_CUTOFF_HOUR,
		0,
		0,
		0,
	);
	if (now.getHours() < DAY_CUTOFF_HOUR) {
		cutoff.setDate(cutoff.getDate() - 1);
	}
	return cutoff;
}

export function isPracticedToday(
	lastPracticed: Date | null | undefined,
	now: Date,
): boolean {
	if (!lastPracticed) return false;
	return lastPracticed.getTime() >= dayStartCutoff(now).getTime();
}
