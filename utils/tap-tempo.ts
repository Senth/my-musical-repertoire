/**
 * Tap tempo: the user taps a steady pulse and we read the tempo off the
 * intervals. 4–8 taps is enough for a stable estimate; anything older than a
 * short pause starts a new phrase instead of contaminating it.
 */

const MIN_TAPS = 4;
const MAX_TAPS = 8;
const RESET_MS = 2000;

/**
 * Record a tap. Returns the phrase so far: taps older than RESET_MS are
 * discarded, and once MAX_TAPS is reached the oldest falls off.
 */
export function addTap(taps: number[], now: number): number[] {
	const previous = taps[taps.length - 1];
	const started = previous === undefined || now - previous > RESET_MS;
	const phrase = started ? [] : taps.slice(-(MAX_TAPS - 1));
	phrase.push(now);
	return phrase;
}

/** BPM from the average interval between taps, or null before MIN_TAPS. */
export function bpmFromTaps(taps: number[]): number | null {
	if (taps.length < MIN_TAPS) return null;
	let total = 0;
	for (let i = 1; i < taps.length; i++) total += taps[i] - taps[i - 1];
	const average = total / (taps.length - 1);
	return Math.round(60000 / average);
}
