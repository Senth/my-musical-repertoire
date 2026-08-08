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

/**
 * Local calendar day a moment belongs to, honouring the 3am cutoff — a log at
 * 01:00 counts towards the previous day. Format is `YYYY-MM-DD`, so string
 * comparison sorts chronologically.
 */
export function dayKey(date: Date): string {
	const shifted = new Date(date.getTime());
	shifted.setHours(shifted.getHours() - DAY_CUTOFF_HOUR);
	const month = `${shifted.getMonth() + 1}`.padStart(2, "0");
	const day = `${shifted.getDate()}`.padStart(2, "0");
	return `${shifted.getFullYear()}-${month}-${day}`;
}

export function isPracticedToday(
	lastPracticed: Date | null | undefined,
	now: Date,
): boolean {
	if (!lastPracticed) return false;
	return lastPracticed.getTime() >= dayStartCutoff(now).getTime();
}
